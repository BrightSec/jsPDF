/* global describe, it, jsPDF, expect, loadGlobals */
describe("Module: Context2D save/restore page scope", () => {
  beforeAll(loadGlobals);

  const PAGE_COUNT = 21;

  function createDoc(pageCount) {
    var doc = new jsPDF({
      orientation: "p",
      unit: "pt",
      format: "a4"
    });
    doc.setCreationDate(new Date(Date.UTC(2020, 0, 1)));
    doc.setFileId("00000000000000000000000000000000");
    for (var i = 1; i < pageCount; i++) {
      doc.addPage();
    }
    return doc;
  }

  function countOps(doc, pageNumber, op) {
    return doc.internal.pages[pageNumber].filter(function(entry) {
      return entry === op;
    }).length;
  }

  function pageLengths(doc) {
    return doc.internal.pages.map(function(page) {
      return page ? page.length : 0;
    });
  }

  function saveRestorePairs(ctx, count) {
    for (var i = 0; i < count; i++) {
      ctx.save();
      ctx.restore();
    }
  }

  it("writes q to all pages when resetContext2D was not published", () => {
    var doc = createDoc(PAGE_COUNT);

    expect(doc.context2d.firstRenderPageIndex).toEqual(0);

    doc.context2d.save();

    for (var page = 1; page <= PAGE_COUNT; page++) {
      expect(countOps(doc, page, "q")).toEqual(1);
    }
  });

  it("resetContext2D sets firstRenderPageIndex to the current page minus two", () => {
    var doc = createDoc(PAGE_COUNT);

    doc.internal.events.publish("resetContext2D");
    expect(doc.context2d.firstRenderPageIndex).toEqual(PAGE_COUNT - 2);

    doc.setPage(1);
    doc.internal.events.publish("resetContext2D");
    expect(doc.context2d.firstRenderPageIndex).toEqual(0);
  });

  it("resetContext2D resets savedCtxPageMap", () => {
    var doc = createDoc(PAGE_COUNT);

    doc.context2d.save();
    expect(doc.context2d.savedCtxPageMap.size).toEqual(PAGE_COUNT);

    doc.internal.events.publish("resetContext2D");
    expect(doc.context2d.savedCtxPageMap.size).toEqual(0);
  });

  it("does not touch pages before firstRenderPageIndex on save/restore", () => {
    var doc = createDoc(PAGE_COUNT);
    doc.internal.events.publish("resetContext2D");
    var lengthsBefore = pageLengths(doc);

    saveRestorePairs(doc.context2d, 1000);

    var lengthsAfter = pageLengths(doc);
    for (var page = 1; page <= PAGE_COUNT - 2; page++) {
      expect(lengthsAfter[page]).toEqual(lengthsBefore[page]);
    }
    expect(countOps(doc, PAGE_COUNT - 1, "q")).toEqual(1000);
    expect(countOps(doc, PAGE_COUNT, "q")).toEqual(1000);
  });

  it("keeps q and Q balanced on every page", () => {
    var doc = createDoc(PAGE_COUNT);
    doc.internal.events.publish("resetContext2D");

    saveRestorePairs(doc.context2d, 1000);

    for (var page = 1; page <= PAGE_COUNT; page++) {
      expect(countOps(doc, page, "q")).toEqual(countOps(doc, page, "Q"));
    }
  });

  it("does not write q or Q to a page added between save and restore", () => {
    var doc = createDoc(PAGE_COUNT);
    doc.internal.events.publish("resetContext2D");

    doc.context2d.save();
    doc.addPage();
    doc.context2d.restore();

    var newPage = PAGE_COUNT + 1;
    expect(countOps(doc, newPage, "q")).toEqual(0);
    expect(countOps(doc, newPage, "Q")).toEqual(0);
    for (var page = PAGE_COUNT - 1; page <= PAGE_COUNT; page++) {
      expect(countOps(doc, page, "q")).toEqual(1);
      expect(countOps(doc, page, "Q")).toEqual(1);
    }
  });

  it("wraps drawing that overshoots onto the previous page in q and Q", () => {
    var doc = createDoc(PAGE_COUNT);
    doc.internal.events.publish("resetContext2D");
    var ctx = doc.context2d;
    ctx.autoPaging = true;
    var previousPage = PAGE_COUNT - 1;
    var pageHeight = doc.internal.pageSize.getHeight();

    ctx.save();
    ctx.fillRect(10, (previousPage - 1) * pageHeight + 100, 50, 50);
    ctx.restore();

    var content = doc.internal.pages[previousPage];
    var drawIndex = content.indexOf("f");
    expect(drawIndex).toBeGreaterThan(-1);
    expect(content.indexOf("q")).toBeLessThan(drawIndex);
    expect(content.lastIndexOf("Q")).toBeGreaterThan(drawIndex);
  });

  it("keeps nested save/restore balanced", () => {
    var doc = createDoc(PAGE_COUNT);
    doc.internal.events.publish("resetContext2D");

    doc.context2d.save();
    doc.context2d.save();
    doc.context2d.save();
    doc.context2d.restore();
    doc.context2d.restore();
    doc.context2d.restore();

    for (var page = 1; page <= PAGE_COUNT; page++) {
      expect(countOps(doc, page, "q")).toEqual(countOps(doc, page, "Q"));
    }
    doc.context2d.savedCtxPageMap.forEach(function(count) {
      expect(count).toEqual(0);
    });
  });

  it("keeps the content of pages before firstRenderPageIndex identical to a doc without save/restore", () => {
    var plainDoc = createDoc(PAGE_COUNT);
    var busyDoc = createDoc(PAGE_COUNT);
    busyDoc.internal.events.publish("resetContext2D");
    saveRestorePairs(busyDoc.context2d, 1000);

    for (var page = 1; page <= PAGE_COUNT - 2; page++) {
      expect(busyDoc.internal.pages[page]).toEqual(
        plainDoc.internal.pages[page]
      );
    }
  });

  it("restores the current page after save and restore", () => {
    var doc = createDoc(PAGE_COUNT);
    doc.internal.events.publish("resetContext2D");
    doc.setPage(PAGE_COUNT - 1);

    doc.context2d.save();
    expect(doc.getCurrentPageInfo().pageNumber).toEqual(PAGE_COUNT - 1);

    doc.context2d.restore();
    expect(doc.getCurrentPageInfo().pageNumber).toEqual(PAGE_COUNT - 1);
  });
});
