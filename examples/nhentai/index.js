const {Util} = __common__("util");
const {ProtocolBase} = __common__("protocol");
const {BookDetail, BookCategory, BookChapter} = __common__("book");

class NHentaiBookDetail extends BookDetail {

    //chpater数据在open时已经完整的得到，所以直接返回相应的chapter
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
                    //解析page对应的url,再从页面中提供src
                    var parser = new DOMParser();
                    var doc = parser.parseFromString(html, "text/html");
                    var all = doc.querySelectorAll("#image-container img");
                    var src = $(all[0]).attr("src");
                    //下载src的图像并返回
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
            //如果继续上一次的搜索并且有最后一次的搜索结果，那么pageNo从上一次的结果增1，否则从0开始
            var pageNo = isContinue && this.lastResult ? this.lastResult.pageNo + 1 : 1;

            //请求书籍列表的url
            var url = 'https://nhentai.net/';
            //如果带有filter，则url替换为搜索用的url
            if (filter)
                url += "search/?q=" + filter + "&page=" + pageNo;
            else
                url += "?page=" + pageNo;

            //访问url
            fetch(url).then(resp => {
                return resp.text();
            }).then(html => {
                var result = {
                    filter: filter,
                    pageNo: pageNo,
                };
                var books = [];
                //解析html页面，得到相关的信息
                var parser = new DOMParser();
                var doc = parser.parseFromString(html, "text/html");
                var all = doc.querySelectorAll(".gallery");
                var pages = this.paserPaginationPage(doc, ".pagination .last", "href", "page=");

                //解析并构造books中的数据
                all.forEach(item => {
                    var cover = $(".cover img", item).attr("data-src");
                    var url = $(".cover", item).attr("href");
                    var name = $(".caption", item).text();
                    var book = {
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

                //因为此站书籍下没有子分类及章节，所以构造一个分类和一个章节
                var category = new BookCategory("", 0);
                category.name = "";
                book.category.push(category);

                var chapter = new BookChapter(0, "", 0);
                category.chapters.push(chapter);

                //构造BookDetail
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



module.exports = {
    NHentaiProtocol,
    default : NHentaiProtocol,
}
