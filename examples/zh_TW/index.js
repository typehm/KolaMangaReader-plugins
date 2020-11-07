const {LanguagePack} = __common__("language");

//declare a protocol
class zh_TW_Protocol extends LanguagePack {
    name = "繁體中文語言包";
    description = "繁體中文的語言界面支援包";
    languageCodeName = "zh-TW";
    languageName = "繁體中文";
    languageJsonPath = __dirname + "/language.json";
}

//export the protocol
module.exports = {
    zh_TW_Protocol,
    default : zh_TW_Protocol,
}
