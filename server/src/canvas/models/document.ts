import { Promise } from "es6-promise";
import * as promisify from "es6-promisify";
import * as uuid from "node-uuid";
import * as collabClient from "../../collab/client";
import { Ink } from "./ink";
import { RichText } from "./richText";

export interface IObject {
    id: string;

    type: string;

    location: {
        x: number;
        y: number;
    };

    width: number;
}

export interface IDocument {
    ink: {
        id: string;
    };

    richText: {
        id: string;
    };
}

export interface IShareDBModel<T> {
    data: T;

    on: Function;

    submitOp: Function;
}

export class Document {
    public static GetOrCreate(connection, id: string): Promise<Document> {
        // Load the model from the server
        let doc = connection.get("canvas", id);

        let subscribe = promisify(doc.subscribe, doc);
        let createDocument = promisify(doc.create, doc);

        let subscribeP: Promise<any> = subscribe();
        let docP = subscribeP.then(() => {
            if (!doc.type) {
                let inkP = Ink.GetOrCreate(connection, uuid.v4());
                let richTextP = RichText.GetOrCreate(connection, uuid.v4());

                return Promise.all([inkP, richTextP]).then((results) => {
                    let initial: IDocument = {
                        ink: {
                            id: results[0].id,
                        },
                        richText: {
                            id: results[1].id,
                        },
                    };

                    return createDocument(initial, collabClient.types.json.type.name).then(() => doc);
                });
            }

            return doc;
        });

        return docP.then(() => {
            return new Document(connection, doc);
        });
    }

    private inkP: Promise<Ink>;
    private richTextP: Promise<RichText>;

    public get data(): IDocument {
        return this.model.data;
    }

    private constructor(private connection: any, private model: IShareDBModel<IDocument>) {
        // Listen for updates and then fetch the promises for the given types
        this.inkP = Ink.GetOrCreate(connection, model.data.ink.id);
        this.richTextP = RichText.GetOrCreate(connection, model.data.richText.id);
    }

    public getInkLayer(): Promise<Ink> {
        return this.inkP;
    }

    public getRichText(): Promise<RichText> {
        return this.richTextP;
    }

    public on(operation: string, callback: Function) {
        this.model.on(operation, callback);
    }

    public submitOp(delta, params) {
        this.model.submitOp(delta, params);
    }
}
