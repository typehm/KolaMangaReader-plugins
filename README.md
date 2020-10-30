# MangaInspector插件文档

MangaInspector支持通过编写插件来扩展系统功能。目前支持对以下的功能进行扩展
  - 界面语言
  - 远程书籍源
  - 本地文件源

插件结构
----

```js
+ 插件目录          
|--- index.js           
|--- readme.md          
|--- 其他依赖文件       
```
一个插件将一个文件夹以zip的形式发布。其中将包含：

- index.js 插件入口，需要按要求导出一个class
- readme.md 插件的readme(可选)。用于在选项页面时显示插件信息。当文件不存在时，使用导出的class的description字段
- 插件依赖的资源

### index.js
插件入口，需要按要求导出一个ProtocolBase的派生类
```js
//基本的index.js例子
//__common__是针对特定路径的require的封装方法
const {ProtocolBase} = __common__("protocol");
//定义一个ProtocolBase的派生类
class dummy_Protocol extends ProtocolBase {
    name = "dummy";
    description = "dummy";
}
//导出上面定义的派生类
module.exports = {
    default : dummy_Protocol,
}
```
上面的例子定义了一个没有任何功能的插件，仅仅是能做为一个合法的插件导入而已。

#### 下面简单几类基本插件的编写的例子。
# 语言扩展
语言扩展能为系统增加新的界面显示语言的支持  
原理是在index.js中注册新的语言类型，并为其加载相应的json文件  
一个语言扩展插件包括以下文件  
```js
+ zh_TW
|--- index.js
|--- readme.md
|--- language.json
```
#### index.js
```js
//引入所需要的模块
const {LanguageManager} = __common__("util");
const {ProtocolBase} = __common__("protocol");
//注册要支持的语言，参数1是对应json中的key，参数2是显示在设置界面中的下拉列表中的语言名称字符串
LanguageManager.Register("zh-TW", "繁體中文");
//加载语言JSON文件
LanguageManager.loadJson(__dirname+"/language.json");
//事实上，新语言的支持已经在这里完成了

//但仍然定义并导出派生类以满足插件的规范
class zh_TW_Protocol extends ProtocolBase {
    name = "繁體中文語言包";
    description = "繁體中文的語言界面支援包";
}
module.exports = {
    default : zh_TW_Protocol,
}
```

### language.json
```json
{
  "zh-TW": [
    {"key": "common.name", "value": "通用"},
    {"key": "common.language", "value": "當前語言"},
    {"key": "common.devMode", "value": "開發者模式"},
    {"key": "common.devmode.nodrag", "value": "打開開發者工具時視窗將無法被拖移"},
    ...
    ...
    {"key": "config.uninstall", "value": "卸載"},
    {"key": "config.filterplaceholder", "value": "查找插件"},
    {"key": "form.path.select", "value": "選擇路徑"},
    {"key": "form.path.open", "value": "打開路徑"},
    {"key": "plugins.name", "value": "插件"}
  ]
}
```

# 远程书籍源
>远程书籍源能为系统增加新的在线书籍源  
原理是通过插件请求远程的http源，获得书籍信息后，封装成系统能识别的书籍数据。  
一个书籍源扩展插件包括以下文件  
```js
+ dmzj
|--- index.js
|--- readme.md
|--- 依赖文件
```
### index.js
>插件入口，需要按要求导出一个ProtocolBase的派生类  
并重载ProtocolBase中的方法，实现对远程数据的请求/解析/封装  
插件的编写将会使用到以下的类  
```js
//书籍源的基类
class ProtocolBase extends PluginBase {
    name = "";
    description = "";
    protocols = "protocols://;";
    isSource = false;
    referer = "";
    icon = "";
    reset() {}
    get(filter, isContinue) {}
    open(uri) {}
    close(book) {}
}
```

#### ProtocolBase.name : string
插件的名称，用于显示在选项页中
#### ProtocolBase.description : string
插件的描述，当插件没有提供readme.md时，将这个字段显示为插件的描述
#### ProtocolBase.isSource : boolean
是否为一个书籍源，当只有isSource为true时，才会被当做一个源来注册入系统
#### ProtocolBase.referer : string
是否为http请求提供一个特别的referer地址，为空字符串时不提供。用于某些服务器要求特定的referer的情况
#### ProtocolBase.icon : string
源的图标的url。用于显示在书库界面中
#### ProtocolBase.reset()
重置状态（目前没有使用）
#### ProtocolBase.get( filter : string, isContinue : boolean ) : Promise({})
从远程服务器获得书籍列表  
此方法应该返回一个Promise,成功时返回一个如下结构的dict,失败时可以简单的返回错误信息字符串或是异常对象  
```js
{
    filter: filter,     //当前请求的filter参数
    pageNo: pageNo,     //当前请求的页号
    books : [],         //当前请求得到的书籍信息的array 
    hasMore : false,    //当前请求之后，是否还有更多的结果可以请求
}
```
books中的数据结构
```js
{
    name: "",           //书籍的显示用的名字
    path: "",           //书籍的path，为protocols中的某一个值+书籍的标识符组成的一串唯一的路径，由插件产生并解析
    thumbnail: "",      //书籍的封面缩略图的url
}
```

filter参数是由空格分隔开的关键词，如果关键词以$开始，则是一个tag,远程源可以简单的将$移除，或是将其接入对应的远端的搜索系统中  
isCountinue参数表示是否继续上一次的搜索。即如果上一次的搜索返回了pageNo为0并且hasMore为true的结果，则这次应该开始pageNo为1的结果集的获取  

#### ProtocolBase.open( uri : string) : Promise(BookDetail)
从远程服务器获得uri对应的书籍的详细信息并组织成一个BookDetail返回。  
此方法应该返回一个Promise,成功时返回一个BookDetail,失败时可以简单的返回错误信息字符串或是异常对象  
uri即get方法中返回的book的path  

```js
//书籍详细信息的基类
//仅展示需要由插件填入的成员及需要重载的方法
class BookDetail {
    id = 0;                                     //书籍的id
    name = "";                                  //书籍的名称
    path = "";                                  //书籍的path，应该与get方法中返回的一致
    thumbnail = "name";                         //书籍的封面url
    category = [BookChapter] ;                              //书籍的分类
    tags = [];                                  //标签列表
    vertical = false;                           //是否是纵向阅读
    LoadChapter( categoryIdx : int, chapterIdx : int ) : Promise(BookChapter)      //读取一个指定的category中的chapter
    LoadImage( page : BookPageInfo ) : Promise(Blob)                          //读取并返回page指定的页的图像blob对象
}

//表示一个具体的章节
class BookChapter
{
    name = "";                          //章节名字，显示用
    id = 0;                             //保留，未使用
    order = 0;                          //章节顺序，对章节排序用
    pages = [];                         //章节之下所有的页的array,具体定义由插件自行解释
    constructor( id, name, order ) 
}

//表示一个书籍中的一个具体的分类
//用在动漫之家这类会在一个书籍下有多个版本的情况，比如不同汉化组或是连载与单行本的分别
class BookCategory
{
    id = 0;                     //保留，未使用
    name = "name";              //分类名字
    chapters = [];              //分类下的章节
    constructor(name, id);
}

//表示一个书籍中的一个具体的页的位置
class BookPageInfo {
    category = 0;           //分类索引
    chapter = 0;            //章节索引
    page = 0;               //页面索引
    constructor( category, chapter, page);
}
```

###### BookDetail.LoadChapter( categoryIdx : int, chapterIdx : int ) : Promise(BookChapter)
读取一个指定的category中的chapter。用于无法在ProtocolBase.open方法中得到具体的章节细节数据时使用。  
有些情况下，你可能只能在open的请求中得到章节的数目，而不能得到其他的详细信息。当开始阅读时，会先调用LoadChapter来准备好chapter中的数据，然后返回给系统。  

###### BookDetail.LoadImage( page : BookPageInfo ) : Promise(Blob)
读取并返回page指定的页的图的Blob对象。  



#### ProtocolBase.close( book : BookDetail) : Promise
关闭打开的书籍源，以释放相应的资源。  
对于基于http的源而言，基本不需要关注此方法。  
主要用于支持本地文件做为源时，关闭打开的文件之类的资源。  



[参考插件例子](https://github.com/typehm/MangaInspector-plugins/tree/main/examples)



# 警告
使用自行或他人编写的插件产生各种后果（包括但不限于用户系统或数据被侵害，产生某些费用，各种权利侵害等）都由使用者自行负担。
