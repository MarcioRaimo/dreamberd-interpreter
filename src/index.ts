import { readFileSync } from 'fs'
import { resolve } from 'path'

interface IVariable {
    declaration: 'var var' | 'var const' | 'const var' | 'const const'
    type: 'string' | 'number'
    value: any
}

export const TokenType = {
    Illegal: "ILLEGAL",
    Eof: 'EOF',
    Ident: 'IDENT',
    Print: 'PRINT',
    ParentesesE: '(',
    ParentesesD: ')',
    EoL: '!',
    SingleQuote: "'",
    DoubleQuote: '"',
    Variable: 'VAR',
    AssignOrEqual: '=',
    Int: 'INT'
} as const;

const treeObj: { [key: string]: string[] } = {
    'print': [
        TokenType.Print,
        TokenType.ParentesesE,
        TokenType.SingleQuote,
        TokenType.Ident,
        TokenType.SingleQuote,
        TokenType.ParentesesD,
        TokenType.EoL
    ]
}

const treeMap = new Map(Object.entries(treeObj))

type TokenItem = typeof TokenType[keyof typeof TokenType];

export type Token = {
    type: TokenItem;
    literal: string;
}

export function createToken(type: TokenItem, literal: string): Token {
    return { type, literal };
}

const _0 = '0'.charCodeAt(0);
const _9 = '9'.charCodeAt(0);

const a = 'a'.charCodeAt(0);
const z = 'z'.charCodeAt(0);

const A = 'A'.charCodeAt(0);
const Z = 'Z'.charCodeAt(0);

const _ = '_'.charCodeAt(0);

function isLetter(character: string): boolean {
    const char = character.charCodeAt(0);
    return a <= char && z >= char || A <= char && Z >= char || char === _;
}

function isNumber(character: string): boolean {
    const char = character.charCodeAt(0);
    return _0 <= char && _9 >= char;
}

const Keywords = {
    'print': createToken(TokenType.Print, 'print'),
    'var': createToken(TokenType.Variable, 'var')
};

export class Tokenizer {
    private lastToken: Token = createToken(TokenType.Illegal, 'Illegal')
    private position: number = 0;
    private readPosition: number = 0;
    private ch!: string;
    public loc: number = 0;
    public tokens: Token[] = [];
    public lines: Token[][] = [];

    constructor(private input: string) {
        this.readChar();
        let line = [];
        while (true) {
            const tok = this.getNextToken();
            if (tok.type === TokenType.EoL) {
                this.lines.push(line)
                line = []
                this.loc++;
                continue;
            }
            if (tok.type === TokenType.Illegal) {
                throw new Error(`Illegal token ${tok.literal} at line ${this.loc}`);
            }
            if (tok.type === TokenType.Eof) {
                break;
            }
            line.push(tok)
            this.tokens.push(tok);
        }
    }

    public getNextToken(): Token {
        this.skipWhitespace();

        let tok: Token | undefined;
        switch (this.ch) {
            case '(':
                tok = createToken(TokenType.ParentesesE, this.ch);
                break;
            case ')':
                tok = createToken(TokenType.ParentesesD, this.ch);
                break;
            case '!':
                tok = createToken(TokenType.EoL, '!');
                break;
            case "'":
                tok = createToken(TokenType.SingleQuote, "'");
                break;
            case '"':
                tok = createToken(TokenType.DoubleQuote, '"');
                break;
            case '=':
                tok = createToken(TokenType.AssignOrEqual, '=');
                break;
            case '\0':
                tok = createToken(TokenType.Eof, 'eof');
                break;
        }

        if (isLetter(this.ch)) {
            const ident = this.readIdent();
            const keyword = Keywords[ident as keyof typeof Keywords];
            if (keyword) {
                this.lastToken = keyword;
                return keyword;
            } else {
                const t = createToken(TokenType.Ident, ident);
                this.lastToken = t;
                return t;
            }
        } else if (isNumber(this.ch)) {
            const t = createToken(TokenType.Int, this.readInt());
            if (this.lastToken.type === TokenType.SingleQuote || this.lastToken.type === TokenType.DoubleQuote) {
                t.type = TokenType.Ident
            }
            this.lastToken = t;
            return t;
        } else if (!tok) {
            return createToken(TokenType.Illegal, this.ch);
        }

        this.readChar();
        this.lastToken = tok as Token;
        return tok as Token;
    }

    private peek(): string {
        if (this.readPosition >= this.input.length) {
            return '\0';
        } else {
            return this.input[this.readPosition];
        }
    }

    private skipWhitespace(): void {
        while (this.ch === ' ' || this.ch === '\t' || this.ch === '\n' || this.ch === '\r') {
            this.readChar();
        }
    }

    private readChar(): void {
        if (this.readPosition >= this.input.length) {
            this.ch = '\0';
        } else {
            this.ch = this.input[this.readPosition];
        }

        this.position = this.readPosition;
        this.readPosition += 1;
    }

    private readIdent(): string {
        const position = this.position;

        while (isLetter(this.ch)) {
            this.readChar();
        }

        return this.input.slice(position, this.position);
    }

    private readInt(): string {
        const position = this.position;

        while (isNumber(this.ch)) {
            this.readChar();
        }

        return this.input.slice(position, this.position);
    }
}

const input = readFileSync(resolve(__dirname, 'input.txt'), 'utf-8');

const lexer = new Tokenizer(input);
console.log('lines')
console.log(lexer.lines)
interpreter(lexer)

function interpreter(tokenizer: Tokenizer) {

    function verifyTree(line: Token[], statement: string) {
        if (treeMap.has(statement)) {
            const tree = treeMap.get(statement)!
            for (let index = 0; index < line.length; index++) {
                const token = line[index];
                const treeToken = tree[index];
                if (token.type !== treeToken) {
                    return false
                }
            }
            return true;
        }
        return false;
    }

    function find(token: string, line: Token[], index: number = 0): Token {
        let i = 0;
        let tok = createToken(TokenType.Illegal, 'Illegal')
        for (const t of line) {
            if (t.type === token) {
                tok = t;
                if (i == index) {
                    break
                } else {
                    i++;
                }
            }
        }
        return tok
    }

    function hasVariable(line: Token[]) {
        for (const t of line) {
            if (variables.has(t.literal)) {
                return true;
            }
        }
        return false;
    }

    const variables = new Map<string, IVariable>();
    for (let index = 0; index < tokenizer.lines.length; index++) {
        const commands = []
        const line = tokenizer.lines[index];
        for (let inner = 0; inner < line.length; inner++) {
            let atual = line[inner]
            if (atual.type === TokenType.Print) {
                if (hasVariable(line)) {
                    const vKey = find(TokenType.Ident, line).literal
                    const v = variables.get(vKey)!
                    if (v.type === 'number') {
                        commands.push(`console.log(${parseInt(v.value)})`)
                    } else {
                        commands.push(`console.log('${v.value}')`)
                    }
                    break;
                }
                commands.push(`console.log('${find(TokenType.Ident, line).literal}')`)
                break;
            }
            if (atual.type === TokenType.Variable) {
                const single = find(TokenType.SingleQuote, line)
                const double = find(TokenType.DoubleQuote, line)
                if (single.type != TokenType.Illegal || double.type != TokenType.Illegal) {
                    variables.set(line[1].literal, {
                            type: 'string',
                            declaration: 'var var',
                            value: find(TokenType.Ident, line, 1).literal
                        }
                    )
                } else {
                    variables.set(line[1].literal, {
                            type: 'number',
                            value: find(TokenType.Int, line).literal,
                            declaration: 'var var'
                        }
                    )
                }
            }
        }
        eval(commands.join())
    }
}
