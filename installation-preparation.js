/* Private installation instruction PDFs. Loaded only when preparation is saved.
 * Unicode text is rendered by the browser, then placed with the photographs in
 * ordinary A4 JPEG PDF pages. No external PDF service or public photo URL.
 */
(function () {
  "use strict";
  const PAGE_WIDTH = 1240, PAGE_HEIGHT = 1754, MARGIN = 76;
  const encoder = new TextEncoder();
  const textBytes = value => encoder.encode(value);

  async function instructionIdentity(input) {
    const semantic = {
      contract: "installation_instruction_v1", jobId: input.jobId,
      title: input.title, customerName: input.customerName, address: input.address,
      description: input.description, powerSource: input.powerSource, powerNote: input.powerNote,
      packing: input.packing || [],
      version: input.version,
      photos: input.photos.map(photo => ({ id: photo.id, purpose: photo.purpose, title: photo.title, storagePath: photo.storagePath })),
    };
    const digest = [...new Uint8Array(await crypto.subtle.digest("SHA-256", textBytes(JSON.stringify(semantic))))]
      .map(value => value.toString(16).padStart(2, "0")).join("");
    const value = digest.slice(0, 32).split("");
    value[12] = "5"; value[16] = ((parseInt(value[16], 16) & 3) | 8).toString(16);
    const hex = value.join("");
    return { digest, id: `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}` };
  }

  function jpegPagesPdf(pages) {
    if (!pages.length) throw new Error("PDF needs at least one page.");
    const objects = [null, textBytes("<< /Type /Catalog /Pages 2 0 R >>")];
    objects.push(textBytes(`<< /Type /Pages /Count ${pages.length} /Kids [${pages.map((_, i) => `${3 + i * 3} 0 R`).join(" ")}] >>`));
    for (const page of pages) {
      const pageNumber = objects.length;
      objects.push(textBytes(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595.28 841.89] /Resources << /XObject << /Im0 ${pageNumber + 1} 0 R >> >> /Contents ${pageNumber + 2} 0 R >>`));
      const prefix = textBytes(`<< /Type /XObject /Subtype /Image /Width ${page.width} /Height ${page.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${page.bytes.length} >>\nstream\n`);
      const suffix = textBytes("\nendstream");
      const image = new Uint8Array(prefix.length + page.bytes.length + suffix.length);
      image.set(prefix); image.set(page.bytes, prefix.length); image.set(suffix, prefix.length + page.bytes.length);
      objects.push(image);
      const content = "q\n595.28 0 0 841.89 0 0 cm\n/Im0 Do\nQ\n";
      objects.push(textBytes(`<< /Length ${textBytes(content).length} >>\nstream\n${content}endstream`));
    }
    const chunks = [new Uint8Array([37,80,68,70,45,49,46,52,10,37,226,227,207,211,10])];
    let size = chunks[0].length;
    const offsets = [0];
    for (let i = 1; i < objects.length; i += 1) {
      offsets.push(size);
      const start = textBytes(`${i} 0 obj\n`), end = textBytes("\nendobj\n");
      chunks.push(start, objects[i], end); size += start.length + objects[i].length + end.length;
    }
    const xrefOffset = size;
    const xref = textBytes(`xref\n0 ${objects.length}\n0000000000 65535 f \n${offsets.slice(1).map(value => `${String(value).padStart(10, "0")} 00000 n \n`).join("")}trailer\n<< /Size ${objects.length} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`);
    chunks.push(xref); size += xref.length;
    const bytes = new Uint8Array(size);
    let cursor = 0; for (const chunk of chunks) { bytes.set(chunk, cursor); cursor += chunk.length; }
    return bytes;
  }

  function makePage() {
    const canvas = document.createElement("canvas"); canvas.width = PAGE_WIDTH; canvas.height = PAGE_HEIGHT;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Canvas is unavailable.");
    context.fillStyle = "#ffffff"; context.fillRect(0, 0, PAGE_WIDTH, PAGE_HEIGHT);
    context.fillStyle = "#075c54"; context.fillRect(0, 0, PAGE_WIDTH, 14);
    context.font = "bold 28px Arial, sans-serif"; context.fillText("NUMEDAL VARMEPUMPESERVICE", MARGIN, 78);
    context.fillStyle = "#526471"; context.font = "22px Arial, sans-serif";
    context.fillText("Instrukcja montażu - tylko do użytku wewnętrznego", MARGIN, 116);
    return { canvas, context };
  }

  function wrapText(context, text, width) {
    const lines = [];
    for (const paragraph of String(text || "").split(/\r?\n/)) {
      let line = "";
      for (const word of paragraph.split(/\s+/)) {
        // Split unbroken filenames/addresses as well as ordinary words.
        const fragments = [];
        let part = "";
        for (const letter of word) {
          if (part && context.measureText(part + letter).width > width) { fragments.push(part); part = letter; }
          else part += letter;
        }
        if (part) fragments.push(part);
        for (const fragment of fragments) {
          if (line && context.measureText(`${line} ${fragment}`).width > width) { lines.push(line); line = fragment; }
          else line = line ? `${line} ${fragment}` : fragment;
        }
      }
      lines.push(line);
    }
    return lines;
  }

  async function loadPhoto(url) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 30000);
    let response, blob;
    try {
      response = await fetch(url, { cache: "no-store", credentials: "omit", signal: controller.signal });
      if (!response.ok) throw new Error("Could not read a private planning picture.");
      blob = await response.blob();
    } finally { clearTimeout(timer); }
    const objectUrl = URL.createObjectURL(blob);
    try {
      const image = new Image(); image.src = objectUrl;
      await image.decode();
      return image;
    } finally { URL.revokeObjectURL(objectUrl); }
  }

  async function createInstructionPdf(input, photoUrl) {
    if (!input.photos.length) throw new Error("No preparation pictures.");
    const canvases = [];
    let page = makePage(), y = 202;
    const nextPage = () => { canvases.push(page.canvas); page = makePage(); y = 202; };
    const paragraph = (title, body) => {
      if (y > PAGE_HEIGHT - 240) nextPage();
      page.context.fillStyle = "#075c54"; page.context.font = "bold 27px Arial, sans-serif";
      page.context.fillText(title, MARGIN, y); y += 44;
      page.context.fillStyle = "#182f3b"; page.context.font = "29px Arial, sans-serif";
      for (const line of wrapText(page.context, body, PAGE_WIDTH - MARGIN * 2)) {
        if (y > PAGE_HEIGHT - 150) { nextPage(); page.context.fillStyle = "#182f3b"; page.context.font = "29px Arial, sans-serif"; }
        page.context.fillText(line, MARGIN, y); y += 42;
      }
      y += 30;
    };
    paragraph("Zlecenie", input.title);
    paragraph("Klient i miejsce montażu", [input.customerName, input.address].filter(Boolean).join("\n"));
    paragraph("Zasilanie", ({ outdoor: "Na zewnątrz (standard)", indoor: "Wewnątrz", unknown: "Nie wiadomo - sprawdź przed montażem" })[input.powerSource] || "Nie wiadomo");
    if (input.powerNote) paragraph("Uwagi o zasilaniu / gniazdku", input.powerNote);
    if (input.packing?.length) paragraph("Materiały i wyposażenie do zabrania", input.packing.join("\n"));
    if (input.description) paragraph("Opis pracy (tekst oryginalny)", input.description);
    paragraph("Zdjęcia planu", "Kolejne strony pokazują proponowane miejsca jednostek. Są to zdjęcia przed montażem. Zdjęcia gotowej instalacji dodaj oddzielnie podczas zakończenia zlecenia.");
    canvases.push(page.canvas);
    const pages = [], pageCount = canvases.length + input.photos.length;
    const encodePage = async canvas => {
      const context = canvas.getContext("2d");
      context.fillStyle = "#526471"; context.font = "21px Arial, sans-serif";
      context.fillText(`Plan montażu | ${pages.length + 1} / ${pageCount}`, MARGIN, PAGE_HEIGHT - 58);
      const blob = await new Promise((resolve, reject) => canvas.toBlob(value => value ? resolve(value) : reject(new Error("Could not render PDF page.")), "image/jpeg", .86));
      pages.push({ width: PAGE_WIDTH, height: PAGE_HEIGHT, bytes: new Uint8Array(await blob.arrayBuffer()) });
      // Release each raster before decoding the next photograph on a phone.
      canvas.width = 0; canvas.height = 0;
    };
    for (const canvas of canvases) await encodePage(canvas);
    for (const photo of input.photos) {
      const image = await loadPhoto(await photoUrl(photo));
      page = makePage(); page.context.fillStyle = "#182f3b"; page.context.font = "bold 38px Arial, sans-serif";
      const label = photo.purpose === "indoor" ? "Jednostka wewnętrzna" : "Jednostka zewnętrzna";
      page.context.fillText(label, MARGIN, 210);
      page.context.font = "23px Arial, sans-serif"; page.context.fillStyle = "#526471";
      const caption = wrapText(page.context, photo.title, PAGE_WIDTH - MARGIN * 2).slice(0, 3);
      caption.forEach((line, index) => page.context.fillText(line, MARGIN, 256 + index * 31));
      const top = 350, width = PAGE_WIDTH - MARGIN * 2, height = PAGE_HEIGHT - top - 155;
      const scale = Math.min(width / image.naturalWidth, height / image.naturalHeight);
      const actualWidth = image.naturalWidth * scale, actualHeight = image.naturalHeight * scale;
      page.context.drawImage(image, MARGIN + (width - actualWidth) / 2, top + (height - actualHeight) / 2, actualWidth, actualHeight);
      await encodePage(page.canvas);
    }
    const bytes = jpegPagesPdf(pages);
    if (bytes.length > 10 * 1024 * 1024) throw new Error("Picture PDF exceeds 10 MB. Keep the original pictures or use smaller images.");
    return bytes;
  }

  window.NumedalInstallationPreparation = Object.freeze({ instructionIdentity, createInstructionPdf, jpegPagesPdf, wrapText });
})();
