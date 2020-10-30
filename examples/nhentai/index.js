const {Util} = __common__("util");
const {ProtocolBase} = __common__("protocol");
const {BookDetail, BookCategory, BookChapter} = __common__("book");

class NHentaiBookDetail extends BookDetail {
    protocol = null;


    LoadChapter(categoryIdx, chapterIdx) {
        return new Promise((resolve, reject) => {
            var chapter = this.category[categoryIdx].chapters[chapterIdx];
            resolve(chapter);
        });
    }

    LoadImage(page) {
        return this.LoadChapter(page.category, page.chapter).then(chapter => {
            var url = 'https://nhentai.net' + chapter.pages[page.page];
            return fetch(url).then(resp => resp.text())
                .then(html => {
                    var parser = new DOMParser();
                    var doc = parser.parseFromString(html, "text/html");
                    var all = doc.querySelectorAll("#image-container img");
                    var src = $(all[0]).attr("src");
                    return Util.downloadImageToBlob(src);
                });
        });
    }
}


class NHentaiProtocol extends ProtocolBase {
    name = "N-Hentai";
    description = "NHentai\n=========\n\n\nLicense\n-------";

    protocols = "nhentai://";
    isSource = true;
    referer = '';
    lastResult = null;
    icon = "https://static.nhentai.net/img/logo.090da3be7b51.svg";
    enable = true;

    actions = [
        "add", "download"
    ];

    paserPaginationPage(doc, sel, attr, sp) {
        try {
            var e = $(doc.querySelectorAll(sel));
            var a = e.attr(attr);
            var v = parseInt(a.split(sp)[1]);
            return v;
        }catch (e) {
        }
        return 0;
    }

    get(filter, isContinue) {
        return new Promise((resolve, reject) => {
            var pageNo = isContinue && this.lastResult ? this.lastResult.pageNo + 1 : 1;

            var url = 'https://nhentai.net/';
            if (filter)
                url += "search/?q=" + filter + "&page=" + pageNo;
            else
                url += "?page=" + pageNo;

            fetch(url).then(resp => {
                return resp.text();
            }).then(html => {
                var result = {
                    filter: filter,
                    pageNo: pageNo,
                };
                var books = [];
                var parser = new DOMParser();
                var doc = parser.parseFromString(html, "text/html");
                var all = doc.querySelectorAll(".gallery");
                var pages = this.paserPaginationPage(doc, ".pagination .last", "href", "page=");

                all.forEach(item => {
                    var cover = $(".cover img", item).attr("data-src");
                    var url = $(".cover", item).attr("href");
                    var name = $(".caption", item).text();
                    var book = {
                        // id: 0,
                        name: name,
                        path: "nhentai://" + url,
                        thumbnail: cover,
                    };
                    books.push(book);
                });

                result.books = books;
                result.hasMore = pageNo < pages;
                this.lastResult = result;
                resolve(result);
            });
        });
    }


    parseDetail(html) {
        var parser = new DOMParser();
        var doc = parser.parseFromString(html, "text/html");
        var all = doc.querySelectorAll(".thumb-container .gallerythumb");
        var pages = [];
        all.forEach((i) => {
            var url = $(i).attr("href");
            pages.push(url);
        });

        var tmp = $(doc.querySelectorAll("#tags .tag-container")).get(2);
        var tags = $( ".tags .tag .name", tmp ).map( (i,v) => {
            return { name : v.innerText };
        }).get();

        return {
            name: $(doc.querySelectorAll(".title span")).text(),
            thumbnail: $(doc.querySelectorAll("#content #cover img")).attr("data-src"),
            pages: pages,
            tags : tags,
        }
    }

    open(uri) {
        return new Promise((resolve, reject) => {
            var url = "https://nhentai.net" + uri;
            var self = this;
            fetch(url).then(resp => {
                return resp.text();
            }).then(html => {
                var book = new NHentaiBookDetail();
                book.category = [];
                book.protocol = self;
                book.url = url;


                var category = new BookCategory("", 0);
                category.name = "";
                book.category.push(category);

                var chapter = new BookChapter(0, "", 0);
                category.chapters.push(chapter);

                var detail = this.parseDetail(html);
                book.name = detail.name;
                book.thumbnail = detail.thumbnail;
                book.tags = detail.tags;

                chapter.pages = detail.pages;

                resolve(book);
            });
        });
    }
};


// protocolMgr.register(new NHentaiProtocol());

module.exports = {
    NHentaiProtocol,
    default : NHentaiProtocol,
}
