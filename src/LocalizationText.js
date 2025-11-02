
if (!String.format) {
    String.format = function(format) {
      var args = Array.prototype.slice.call(arguments, 1);
      return format.replace(/{(\d+)}/g, function(match, number) { 
        return typeof args[number] != 'undefined'
          ? args[number] 
          : match
        ;
      });
    };
}

  
export class LocalizationText {
    constructor(texts, locale = 'en') {
        this.texts = texts;
        if (locale in this.texts) {
            this.locale_ = locale;
        } else {
            this.locale_ = 'en'
        }
    }

    set locale(locale) {
        if (locale in this.texts) {
            this.locale_ = locale;
        }
    } 

    get locale() {
        return this.locale_;
    }

    text(label) {
        if (arguments.length <= 1) {
            if (label in this.texts[this.locale_]) {
                return this.texts[this.locale_][label];
            } 
            return this.texts[this.locale_]['label_not_found'];
        } else {
            if (label in this.texts[this.locale_]) {
                let _text = this.texts[this.locale_][label]; 
                return String.format(_text, arguments[1], arguments[2], arguments[3]);
            } 
            return this.texts[this.locale_]['label_not_found'];
        }
    }
    textValue(value) {
        if (arguments.length <= 1) {
            return value;
        }
        return String.format(value, arguments[1], arguments[2], arguments[3]);
    }
} 