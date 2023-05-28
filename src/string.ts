
class Field<T> {
    value: T | undefined
    constructor(value?: T) {
        this.value = value
    }
}

export class StringField extends Field<string> {
    constructor (default_value?: string) {
        super(default_value)
    }
}


export class _ {}
export class ChoiceField<T extends {[key: string]: _}> extends Field<keyof T> {
    options: T;
    constructor (options: T, default_option?: keyof T) {
        super(default_option)
        this.options = options;
    }
}

export class StringStorage<T extends {[key: string]: Field<any>}> {

    public data = {} as { [K in keyof T]: T[K]['value'] };
    public set = {} as { [K in keyof T]: (value: T[K]['value']) => string };
    public is = {} as { [K in keyof T]: (value: T[K]['value']) => boolean }

    structure: T;

    private key_to_keyid = {} as {[K in Extract<keyof T, string>]: string};
    private keyid_to_key = {} as {[id: string]: string};

    private key_option_to_optionid = {} as {[id: string]: {[option: string]: string}};
    private keyid_optionid_to_option = {} as {[id: string]: {[optionid: string]: string}};


    constructor(structure: T) {

        this.structure = structure;

        for (const key in this.structure) {
            if (this.structure.hasOwnProperty(key)) {
                this.set[key] = (value: T[typeof key]['value']) => {
                    this.data[key] = this.setValue(key, value);
                    return this.encode();
                }
                this.is[key] = (value: T[typeof key]['value']) => {
                    return this.data[key] === this.setValue(key, value);
                }
            }
        }


        let i = 0;
        for (const key in this.structure) {
            if (this.structure.hasOwnProperty(key)) {
                const keyid = i.toString(36);
                this.key_to_keyid[key] = keyid;
                this.keyid_to_key[keyid] = key;
                i++;
            }
        }


        for (const key in this.structure) {
            if (this.structure.hasOwnProperty(key)) {

                const field = this.structure[key];
                if (field instanceof ChoiceField) {
                    this.key_option_to_optionid[key] = {};
                    this.keyid_optionid_to_option[this.key_to_keyid[key]] = {};
                    let i = 0;
                    for (const option in field.options) {
                        if (field.options.hasOwnProperty(option)) {
                            const optionid = i.toString(36);
                            this.key_option_to_optionid[key][option] = optionid;
                            this.keyid_optionid_to_option[this.key_to_keyid[key]][optionid] = option;
                            i++;
                        }
                    }
                }

            }
        }

    }



    private setValue(key: string, value: Field<any>): any {
        if (!this.structure.hasOwnProperty(key)) throw new Error("Key does not exist");
        const field = this.structure[key];
        if (field instanceof ChoiceField) {
            if (!field.options.hasOwnProperty(value)) throw new Error("Option does not exist");
            return value;
        } else if (field instanceof StringField) {
            return value;
        }
    }


    private readonly escape_char = "z";
    private readonly field_delimiter = "q";
    private readonly pair_delimiter = "j";
    private readonly field_delimiter_regex = /(?<!z)q/g;
    private readonly pair_delimiter_regex = /(?<!z)j/g;
    private encode_string: (value: string) => string = (value) => value.replace(/[zqj]/g, (match) => this.escape_char + match)
    private decode_string = (str: string) => str.replace(/z([zqj])/g, (match, p1) => p1)

    encode(): string {

        let encoded_str = "";
        for (const key in this.data) {
            if (this.data.hasOwnProperty(key)) {
                const field = this.structure[key];
                const value = this.data[key];

                if (field instanceof ChoiceField) {
                    encoded_str += this.encode_string(this.key_to_keyid[key]) + this.field_delimiter + this.encode_string(this.key_option_to_optionid[key][value]) + this.pair_delimiter;
                } else if (field instanceof StringField) {
                    encoded_str += this.encode_string(this.key_to_keyid[key]) + this.field_delimiter + this.encode_string(value) + this.pair_delimiter;
                }
            }
        }
        return encoded_str;
    }


    decode(encoded_str: string): this {
            
        const pairs = encoded_str.split(this.pair_delimiter_regex);
        if (pairs.pop() !== "") // remove last element (empty string)
            throw new Error(`Invalid encoded string ${encoded_str}`);

        for (const pair of pairs) {
            const [keyid, ...value] = pair.split(this.field_delimiter_regex);
            let key = this.keyid_to_key[this.decode_string(keyid)];
            const field = this.structure[key]; // key: [K in keyof T]
            if (!field) 
                throw new Error(`Invalid encoded string ${encoded_str}`);
            const validKey = key as keyof T;

            if (field instanceof ChoiceField) {
                const optionid = this.decode_string(value.join(this.field_delimiter));
                this.data[validKey] = this.keyid_optionid_to_option[keyid][optionid];
            } else if (field instanceof StringField) {
                this.data[validKey] = this.decode_string(value.join(this.field_delimiter));
            } else {
                throw new Error(`Invalid encoded string ${encoded_str}`);
            }

        }

        return this;
    }

}

