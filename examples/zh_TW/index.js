const {LanguageManager} = __common__("util");
const {ProtocolBase} = __common__("protocol");

//register a language
LanguageManager.Register("zh-TW", "繁體中文");

//load language's JSON file
LanguageManager.loadJson(__dirname+"/language.json");

//declare a protocol
class zh_TW_Protocol extends ProtocolBase {
    name = "繁體中文語言包";
    description = "繁體中文的語言界面支援包";
}

//export the protocol
module.exports = {
    zh_TW_Protocol,
    default : zh_TW_Protocol,
}
