const {Util} = __common__("util");
const {ProtocolBase} = __common__("protocol");
const {BookDetail, BookCategory, BookChapter} = __common__("book");

class EHentaiBookDetail extends BookDetail {
    protocol = null;
    totalPages = 0;
    imagePerPage = 0;
    pagesURL = "";

    LoadImage(page) {
        return this.LoadChapter(page.category, page.chapter).then(chapter => {
            var url = chapter.pages[page.page];
            return new Promise((resolve, reject) => {
                if ( url )
                    resolve( url );
                else
                {
                    var p = Math.floor( page.page / this.imagePerPage );
                    var si = p * this.imagePerPage;
                    var purl = this.pagesURL + "?p="+p;
                    fetch(purl).then( resp => resp.text())
                        .then( html => {
                        var parser = new DOMParser();
                        var doc = parser.parseFromString(html, "text/html");
                        var imgs = doc.querySelectorAll("div.gdtm a");
                        imgs.forEach( (v,i) => {
                            chapter.pages[ si + i ] = v.href;
                        });
                        resolve( chapter.pages[page.page ] );
                    });
                }
            })
            .then(url => {
                return fetch(url)
            })
            .then(resp => resp.text()).then(html => {
                var parser = new DOMParser();
                var doc = parser.parseFromString(html, "text/html");
                var img = doc.querySelectorAll("img#img");
                var src = img[0].src;
                return Util.downloadImageToBlob( src );
            });
        });
    }

    LoadChapter(categoryIdx, chapterIdx) {
        return new Promise((resolve, reject) => {
            var chapter = this.category[categoryIdx].chapters[chapterIdx];
            resolve(chapter);
        });
    }


    Close() {
    }
}


class EHentaiProtocol extends ProtocolBase{
    name = "E-Hentai";
    description = "E-Hentai\n=========\n\n\nLicense\n-------";

    protocols = "ehentai://";
    isSource = true;
    enable = true;
    referer = '';
    icon = "https://static.nhentai.net/img/logo.090da3be7b51.svg";
    lastResult = null;

    get(filter, isContinue) {
        return new Promise((resolve, reject) => {

            var pageNo = isContinue && this.lastResult ? this.lastResult.pageNo + 1 : 0;

            var url = 'https://e-hentai.org/';
            if (filter)
                url += "?f_search=" + filter + "&page=" + pageNo;
            else
                url += "?&page=" + pageNo;

            console.log(url);
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
                var all = doc.querySelectorAll("tr");
                var tmp = doc.querySelectorAll(".ptb td a");
                var pages = parseInt( $(  tmp[ tmp.length -2 ] ).text() );

                all.forEach( item => {
                    var gl = $(".glname>a", item);
                    if (gl.length == 0) return;

                    var n = $(".glthumb div img", item);
                    var cover = n.attr("data-src") || n.attr("src");
                    var url = gl.attr("href");
                    var name = $(".glink", gl).text();
                    var book = {
                        // id: 0,
                        name: name,
                        path: "ehentai://" + url.replace("https://e-hentai.org/", ""),
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

        var pages = [];
        var totalPages = parseInt($(doc.querySelectorAll("#gd3 #gdd .gdt2")[5]).text().replace(" pages", ""));
        for (var i = 0; i < totalPages; i++)
            pages.push("");

        var thumbnail = doc.querySelectorAll("#gleft #gd1 div")[0].style.backgroundImage.replace("url(\"", "").replace("\")", "");

        var tags = $(doc.querySelectorAll("#taglist .gtl a")).map( (i,v) =>{
            return { name : v.innerText }
        } ).get();

        return {
            name: $(doc.querySelectorAll("h1#gn")).text(),
            thumbnail: thumbnail,
            totalPages: totalPages,
            imagePerPage: doc.querySelectorAll("div.gdtm a").length,
            pages: pages,
            pageUrl: $(doc.querySelectorAll(".ptds a")).attr("href"),
            tags : tags,
        }
    }


    open(uri) {
        return new Promise((resolve, reject) => {
            var url = "https://e-hentai.org/" + uri;
            var self = this;
            fetch(url).then(resp => {
                return resp.text();
            }).then(html => {
                console.log(url);
                var book = new EHentaiBookDetail();
                book.category = [];
                book.protocol = self;

                var category = new BookCategory();
                category.name = "";
                book.category.push(category);

                var chapter = new BookChapter();
                category.chapters.push(chapter);

                chapter.html = html;

                var detail = this.parseDetail(html);
                console.log(detail);

                book.name = detail.name;
                book.thumbnail = detail.thumbnail;
                book.totalPages = detail.totalPages;
                book.imagePerPage = detail.imagePerPage;
                book.pagesURL = detail.pageUrl;
                book.tags = detail.tags;

                chapter.pages = detail.pages;

                resolve(book);
            });
        });
    }
};


// protocolMgr.register(new EHentaiProtocol());


module.exports = {
    EHentaiProtocol,
    default : EHentaiProtocol,
}
