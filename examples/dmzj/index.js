const {Util} = __common__("util");
const {ProtocolBase} = __common__("protocol");
const {BookDetail, BookChapter, BookCategory} = __common__("book");

class DmzjBookDetail extends BookDetail {

    LoadImage(page) {
        //先加载章节数据，章节数据加载成功时，开始加载图像数据
        return this.LoadChapter(page.category, page.chapter).then(chapter => {
            var url = chapter.pages[page.page];
            return Util.downloadImageToBlob(url, "http://images.dmzj.com/");
        });
    }

    LoadChapter(categoryIdx, chapterIdx) {
        return new Promise((resolve, reject) => {
            var chapter = this.category[categoryIdx].chapters[chapterIdx];
            //判断是否已经是取得过pages数据的章节，如果是的话，直接返回
            if (chapter.pages.length != 0)
                resolve(chapter);
            else {
                //如果pages的length为0，那么通过api出取得章节中的详细信息并填入chapter中，然后返回
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
    icon = "https://www.dmzj.com/favicon.ico";

    //最后一次的搜索结果
    lastResult = null;

    get(filter, isContinue) {
        //将tag替换为普通的关键词
        filter = filter.replace("$", "");
        return new Promise((resolve, reject) => {
            //如果继续上一次的搜索并且有最后一次的搜索结果，那么pageNo从上一次的结果增1，否则从0开始
            var pageNo = isContinue && this.lastResult ? this.lastResult.pageNo + 1 : 0;

            //请求dmzj书籍列表的url
            var url = 'http://v2.api.dmzj.com/classify/0/0/' + pageNo + '.json';
            //如果带有filter，则url替换为搜索用的url
            if (filter)
                url = "http://s.acg.dmzj.com/comicsum/search.php?s=" + filter;

            //访问url
            fetch(url).then(resp => {
                //如果是搜索的结果，那么将它转换为与普通的情况一致的格式
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
                //把从上一个阶段中的json数据转换为book数据
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
        //uri是上面get方法中已经去掉了dmzj://的path数据
        var self = this;
        return new Promise((resolve, reject) => {
            var id = uri;
            //从uri构造出这个书籍的实际url
            var url = "http://v2.api.dmzj.com/comic/" + id + ".json";
            console.log(url);
            fetch(url).then(resp => {
                return resp.json();
            }).then(json => {
                console.log(json);
                //构造BookDetail
                var book = new DmzjBookDetail();
                book.id = id;
                book.name = json.title;
                book.referer = this.referer;
                book.thumbnail = json.cover;
                book.tags = json.types.map( i => {
                    return {name: i.tag_name};
                });
                book.vertical = json.islong == 1;

                //为detail填充章节数据
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
                //某些情况下会出错，如被隐藏的漫画之类的，可以列出但是无法用api打开
                //由于无法知道具体原理，简单返回不存在
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
