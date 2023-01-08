export type PostEvent = {
    queryString: string;
    parameter: { [index: string]: string; };
    parameters: { [index: string]: [string]; };
    contentLenth: number;
    postData: {
        length: number;
        type: string;
        contents: string;
        name: string;
    };
}
