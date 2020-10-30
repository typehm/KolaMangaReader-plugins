const {Util} = __common__("util");
const {ProtocolBase} = __common__("protocol");
const {BookDetail, BookChapter, BookCategory} = __common__("book");

class DmzjBookDetail extends BookDetail {
    protocol = null;

    LoadImage(page) {
        return this.LoadChapter(page.category, page.chapter).then(chapter => {
            var url = chapter.pages[page.page];
            return Util.downloadImageToBlob(url, "http://images.dmzj.com/");
        });
    }

    LoadChapter(categoryIdx, chapterIdx) {
        return new Promise((resolve, reject) => {
            var chapter = this.category[categoryIdx].chapters[chapterIdx];
            if (chapter.pages.length != 0)
                resolve(chapter);
            else {
                var url = "http://v2.api.dmzj.com/chapter/" + this.id + "/" + chapter.id + ".json";
                fetch(url).then(resp => resp.json())
                    .then(json => {
                        json.page_url.forEach(pUrl => {
                            chapter.pages.push(pUrl);
                        });
                        resolve(chapter);
                    });
            }
        });
    }


    Close() {
    }
}


class DMZJProtocol extends ProtocolBase {
    name = "动漫之家";

    description = "**动漫之家**\n=========";

    protocols = "dmzj://";
    isSource = true;
    referer = 'https://manhua.dmzj.com';
    lastResult = null;
    icon = "https://www.dmzj.com/favicon.ico";

    actions = [
        "add", "download"
    ];

    get(filter, isContinue) {
        //tag as normal keyword
        filter = filter.replace("$", "");
        return new Promise((resolve, reject) => {

            var pageNo = isContinue && this.lastResult ? this.lastResult.pageNo + 1 : 0;

            var url = 'http://v2.api.dmzj.com/classify/0/0/' + pageNo + '.json';
            if (filter)
                url = "http://s.acg.dmzj.com/comicsum/search.php?s=" + filter;

            fetch(url).then(resp => {
                if (filter) {
                    return resp.text().then(text => {
                        if (!text)
                            return [];
                        text = text.replace("];", "]").replace("var g_search_data = ", "");
                        var ret = JSON.parse(text);
                        ret.forEach(item => {
                            item.title = item.comic_name;
                        });
                        return ret;
                    });
                } else
                    return resp.json();
            }).then(json => {
                var result = {
                    filter: filter,
                    pageNo: pageNo,
                };
                var books = [];
                json.forEach(item => {
                    var book = {
                        id: item.id,
                        name: item.title,
                        path: "dmzj://" + item.id,
                        thumbnail: item.cover,
                        referer: this.referer,
                    };
                    books.push(book);
                });

                result.books = books;
                result.hasMore = !filter ? books.length > 0 : false;
                this.lastResult = result;
                resolve(result);
            }).catch( resolve );
        });
    }

    open(uri) {
        var self = this;
        return new Promise((resolve, reject) => {
            var id = uri;
            var url = "http://v2.api.dmzj.com/comic/" + id + ".json";
            console.log(url);
            fetch(url).then(resp => {
                return resp.json();
            }).then(json => {
                console.log(json);
                var book = new DmzjBookDetail();
                book.id = id;
                book.name = json.title;
                book.referer = this.referer;
                book.thumbnail = json.cover;
                book.tags = json.types.map( i => {
                    return {name: i.tag_name};
                });
                book.vertical = json.islong == 1;

                json.chapters.map(chapter => {
                    var category = new BookCategory(chapter.title);
                    book.category.push(category);
                    chapter.data.forEach(c => {
                        var _c = new BookChapter(c.chapter_id, c.chapter_title, c.chapter_order);
                        category.chapters.push(_c);
                    });
                    category.chapters.sort((a, b) => a.order - b.order);
                });
                resolve(book);
            }).catch(e=>{
                console.log(e);
                reject( "漫画不存在！" );
            })
        });
    }

};


// protocolMgr.register(new DMZJProtocol());


module.exports = {
    DMZJProtocol,
    default : DMZJProtocol,
}
