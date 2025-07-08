// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';

// 支持树结构的节点类型
interface JSDocNode {
    label: string; // summary
    description: string; // 签名
    tooltip: string; // @项
    line: number;
    children?: JSDocNode[];
}

class JSDocTreeItem extends vscode.TreeItem {
    constructor(
        public readonly node: JSDocNode
    ) {
        super(node.label, node.children && node.children.length > 0 ? vscode.TreeItemCollapsibleState.Collapsed : vscode.TreeItemCollapsibleState.None);
        this.description = node.description;
        this.tooltip = node.tooltip;
        this.command = {
            command: 'xzynine-jsdoc-comment-outline.revealLine',
            title: '',
            arguments: [node.line]
        };
    }
}

class JSDocOutlineProvider implements vscode.TreeDataProvider<JSDocTreeItem> {
    private _onDidChangeTreeData: vscode.EventEmitter<JSDocTreeItem | undefined | void> = new vscode.EventEmitter<JSDocTreeItem | undefined | void>();
    readonly onDidChangeTreeData: vscode.Event<JSDocTreeItem | undefined | void> = this._onDidChangeTreeData.event;
    private items: JSDocNode[] = [];

    refresh(items: JSDocNode[]): void {
        this.items = items;
        this._onDidChangeTreeData.fire();
    }

    getTreeItem(element: JSDocTreeItem): vscode.TreeItem {
        // 添加右键菜单命令
        element.contextValue = 'jsdocItem';
        return element;
    }

    getChildren(element?: JSDocTreeItem): Thenable<JSDocTreeItem[]> {
        if (!element) {
            return Promise.resolve(this.items.map(n => new JSDocTreeItem(n)));
        }
        if (element.node.children) {
            return Promise.resolve(element.node.children.map(n => new JSDocTreeItem(n)));
        }
        return Promise.resolve([]);
    }
}

async function generateJSDocOutlineFromSymbols(document: vscode.TextDocument): Promise<JSDocNode[]> {
    // 获取文档结构大纲
    const symbols = await vscode.commands.executeCommand<vscode.DocumentSymbol[]>(
        'vscode.executeDocumentSymbolProvider',
        document.uri
    );
    if (!symbols) return [];

    // 递归处理 symbol
    function processSymbol(symbol: vscode.DocumentSymbol): JSDocNode | null {
        // 获取 symbol 前的 JSDoc 注释
        const startLine = symbol.range.start.line;
        let jsdoc = '';
        for (let i = startLine - 1; i >= 0; i--) {
            const lineText = document.lineAt(i).text.trim();
            if (lineText.startsWith('/**')) {
                // 找到 JSDoc 起始
                let commentLines = [lineText];
                for (let j = i + 1; j < startLine; j++) {
                    commentLines.push(document.lineAt(j).text.trim());
                }
                jsdoc = commentLines.join('\n');
                break;
            } else if (lineText.startsWith('*/') || lineText.startsWith('*')) {
                // 继续向上找
                continue;
            } else if (lineText === '' || lineText.startsWith('//')) {
                continue;
            } else {
                // 非注释内容，终止
                break;
            }
        }
        if (!jsdoc) return null;
        // 解析 JSDoc 内容
        const comment = jsdoc.replace(/^\/\*\*|\*\/$/g, '').split('\n').map(l => l.replace(/^\s*\* ?/, '').trim());
        const summary = comment.find(l => l && !l.startsWith('@')) || '';
        const tags = comment.filter(l => l.startsWith('@')).join('\n');
        const node: JSDocNode = {
            label: summary,
            description: symbol.name + (symbol.detail ? ' ' + symbol.detail : ''),
            tooltip: tags,
            line: symbol.range.start.line,
        };
        if (symbol.children && symbol.children.length > 0) {
            const children = symbol.children.map(processSymbol).filter(Boolean) as JSDocNode[];
            if (children.length > 0) node.children = children;
        }
        return node;
    }
    // 只收录有 JSDoc 的 symbol
    const result: JSDocNode[] = [];
    for (const sym of symbols) {
        const node = processSymbol(sym);
        if (node) result.push(node);
    }
    return result;
}

export function activate(context: vscode.ExtensionContext) {

	// 使用控制台输出诊断信息 (console.log) 和错误 (console.error)
	// 这行代码只会在扩展激活时执行一次
	console.log('恭喜，您的扩展 "xzynine-jsdoc-comment-outline" 已激活！');

	// 该命令已在 package.json 文件中定义
	// 现在使用 registerCommand 提供命令的实现
	// commandId 参数必须与 package.json 中的 command 字段匹配
	const disposable = vscode.commands.registerCommand('xzynine-jsdoc-comment-outline.helloWorld', () => {
		// 每次命令执行时会运行这里的代码
		// 向用户显示消息框
		vscode.window.showInformationMessage('Hello World from JSDoc Comment Outline!');
	});

	context.subscriptions.push(disposable);

    const outlineProvider = new JSDocOutlineProvider();
    vscode.window.registerTreeDataProvider('jsdocCommentOutline', outlineProvider);

    context.subscriptions.push(
        vscode.commands.registerCommand('xzynine-jsdoc-comment-outline.revealLine', (line: number) => {
            const editor = vscode.window.activeTextEditor;
            if (editor) {
                const pos = new vscode.Position(line, 0);
                editor.selection = new vscode.Selection(pos, pos);
                editor.revealRange(new vscode.Range(pos, pos));
            }
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('xzynine-jsdoc-comment-outline.copyTitleDesc', (item: JSDocTreeItem) => {
            const text = `${item.label} ${item.description}`.trim();
            vscode.env.clipboard.writeText(text);
            vscode.window.showInformationMessage('已复制大纲标题和副标题！');
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('xzynine-jsdoc-comment-outline.copyAllTitleDesc', () => {
            function collect(node: JSDocNode, indent = 0, isLast = true, prefix = ''): string[] {
                let branch = '';
                if (indent > 0) {
                    branch = prefix + (isLast ? '└─' : '├─');
                }
                const line = `${branch}${node.label} ${node.description}`;
                let children: string[] = [];
                if (node.children && node.children.length > 0) {
                    const newPrefix = prefix + (indent > 0 ? (isLast ? '  ' : '│ ') : '');
                    node.children.forEach((child, idx) => {
                        children = children.concat(collect(child, indent + 1, idx === node.children!.length - 1, newPrefix));
                    });
                }
                return [line, ...children];
            }
            const all = outlineProvider['items'].flatMap((node, idx, arr) => collect(node, 0, idx === arr.length - 1));
            vscode.env.clipboard.writeText(all.join('\n'));
            vscode.window.showInformationMessage('已复制全部大纲标题和副标题（含树状符号）！');
        })
    );

    // 修改 updateOutline，使用新方法
    function updateOutline() {
        const editor = vscode.window.activeTextEditor;
        if (editor && (editor.document.languageId === 'javascript' || editor.document.languageId === 'typescript')) {
            generateJSDocOutlineFromSymbols(editor.document).then(items => {
                outlineProvider.refresh(items);
            });
        } else {
            outlineProvider.refresh([]);
        }
    }

    vscode.window.onDidChangeActiveTextEditor(updateOutline, null, context.subscriptions);
    vscode.workspace.onDidChangeTextDocument(updateOutline, null, context.subscriptions);
    updateOutline();
}

// This method is called when your extension is deactivated
export function deactivate() {}
