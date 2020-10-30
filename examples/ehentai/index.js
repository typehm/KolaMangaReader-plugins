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
                //如果已经有url了，返回给下一个阶段
                if ( url )
                    resolve( url );
                else
                //如果还没有url,则要先提取。因为eh的一个漫画里可能分很多页，而事先提供全部url会导致打开很慢，所以采取使用时再提取的方法
                //技术上可以采取更主动的预读策略来隐藏这个过程，这里只是演示则不深入
                {
                    //从page推出在哪一个分页，然后构造分页url
                    var p = Math.floor( page.page / this.imagePerPage );
                    var si = p * this.imagePerPage;
                    var purl = this.pagesURL + "?p="+p;
                    //请求url
                    fetch(purl).then( resp => resp.text())
                        .then( html => {
                        //解析html,得到这个分页上的图像的url,保存起来
                        var parser = new DOMParser();
                        var doc = parser.parseFromString(html, "text/html");
                        var imgs = doc.querySelectorAll("div.gdtm a");
                        imgs.forEach( (v,i) => {
                            chapter.pages[ si + i ] = v.href;
                        });
                        //返回需要读取的页面url
                        resolve( chapter.pages[page.page ] );
                    });
                }
            })
            .then(url => {
                return fetch(url)
            })
            .then(resp => resp.text()).then(html => {
                //解析实际的图像页面
                var parser = new DOMParser();
                var doc = parser.parseFromString(html, "text/html");
                var img = doc.querySelectorAll("img#img");
                var src = img[0].src;
                //加载图像并返回blob
                return Util.downloadImageToBlob( src );
            });
        });
    }

    //chpater数据在open时已经完整的得到，所以直接返回相应的chapter
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
            //如果继续上一次的搜索并且有最后一次的搜索结果，那么pageNo从上一次的结果增1，否则从0开始
            var pageNo = isContinue && this.lastResult ? this.lastResult.pageNo + 1 : 0;

            //请求书籍列表的url
            var url = 'https://e-hentai.org/';
            //如果带有filter，则url替换为搜索用的url
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

                //解析html页面，得到相关的信息
                var books = [];
                var parser = new DOMParser();
                var doc = parser.parseFromString(html, "text/html");
                var all = doc.querySelectorAll("tr");
                var tmp = doc.querySelectorAll(".ptb td a");
                var pages = parseInt( $(  tmp[ tmp.length -2 ] ).text() );

                //解析并构造books中的数据
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

                //因为此站书籍下没有子分类及章节，所以构造一个分类和一个章节
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
