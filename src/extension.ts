// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';

class JSDocTreeItem extends vscode.TreeItem {
    constructor(
        public readonly label: string, // summary
        public readonly collapsibleState: vscode.TreeItemCollapsibleState,
        public readonly line: number,
        public readonly description: string, // 函数/类签名
        public readonly tags: string
    ) {
        super(label, collapsibleState);
        this.description = description; // 显示函数/类签名
        this.tooltip = tags;    // 鼠标悬浮显示 @param/@returns 等
        this.command = {
            command: 'xzynine-jsdoc-comment-outline.revealLine',
            title: '',
            arguments: [line]
        };
    }
}

class JSDocOutlineProvider implements vscode.TreeDataProvider<JSDocTreeItem> {
    private _onDidChangeTreeData: vscode.EventEmitter<JSDocTreeItem | undefined | void> = new vscode.EventEmitter<JSDocTreeItem | undefined | void>();
    readonly onDidChangeTreeData: vscode.Event<JSDocTreeItem | undefined | void> = this._onDidChangeTreeData.event;
    private items: JSDocTreeItem[] = [];

    refresh(items: JSDocTreeItem[]): void {
        this.items = items;
        this._onDidChangeTreeData.fire();
    }

    getTreeItem(element: JSDocTreeItem): vscode.TreeItem {
        return element;
    }

    getChildren(element?: JSDocTreeItem): Thenable<JSDocTreeItem[]> {
        if (!element) {
            return Promise.resolve(this.items);
        }
        return Promise.resolve([]);
    }
}

function parseJSDocComments(text: string): JSDocTreeItem[] {
    const regex = /\/\*\*([\s\S]*?)\*\/(?:\s*\n)?(export\s+)?(async\s+)?(function|class|const|let|var)\s+([\w$]+)/g;
    const items: JSDocTreeItem[] = [];
    let match;
    while ((match = regex.exec(text)) !== null) {
        const [, comment, , , type, name] = match;
        const line = text.slice(0, match.index).split('\n').length - 1;
        const lines = comment.split('\n').map(l => l.replace(/^\s*\* ?/, '').trim());
        const summary = lines.find(l => l && !l.startsWith('@')) || '';
        const tags = lines.filter(l => l.startsWith('@')).join('\n');
        const signature = `${type} ${name}`;
        items.push(new JSDocTreeItem(summary, vscode.TreeItemCollapsibleState.None, line, signature, tags));
    }
    return items;
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

    function updateOutline() {
        const editor = vscode.window.activeTextEditor;
        if (editor && (editor.document.languageId === 'javascript' || editor.document.languageId === 'typescript')) {
            const text = editor.document.getText();
            const items = parseJSDocComments(text);
            outlineProvider.refresh(items);
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
