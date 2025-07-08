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

function parseJSDocComments(text: string): JSDocNode[] {
    const items: JSDocNode[] = [];
    const classMap: Record<string, JSDocNode> = {};
    // 先处理所有 class 及其成员
    const classBodyRegex = /\/\*\*([\s\S]*?)\*\/\s*class\s+([\w$]+)[^{]*{([\s\S]*?)^}/gm;
    let match: RegExpExecArray | null;
    while ((match = classBodyRegex.exec(text)) !== null) {
        const [, classComment, className, classBody] = match;
        const classStart = text.slice(0, match.index).split('\n').length - 1;
        const classLines = classComment.split('\n').map(l => l.replace(/^\s*\* ?/, '').trim());
        const classSummary = classLines.find(l => l && !l.startsWith('@')) || '';
        const classTags = classLines.filter(l => l.startsWith('@')).join('\n');
        const classNode: JSDocNode = {
            label: classSummary,
            description: `class ${className}`,
            tooltip: classTags,
            line: classStart,
            children: []
        };
        // 解析类体内成员
        const memberRegex = /\/\*\*([\s\S]*?)\*\/\s*(constructor|[\w$]+)\s*\(([^)]*)\)/g;
        let m: RegExpExecArray | null;
        while ((m = memberRegex.exec(classBody)) !== null) {
            const [full, memberComment, memberName] = m;
            const memberLine = classStart + classBody.slice(0, m.index).split('\n').length;
            const memberLines = memberComment.split('\n').map(l => l.replace(/^\s*\* ?/, '').trim());
            const memberSummary = memberLines.find(l => l && !l.startsWith('@')) || '';
            const memberTags = memberLines.filter(l => l.startsWith('@')).join('\n');
            const memberNode: JSDocNode = {
                label: memberSummary,
                description: memberName === 'constructor' ? 'constructor' : `method ${memberName}`,
                tooltip: memberTags,
                line: memberLine
            };
            classNode.children!.push(memberNode);
        }
        classMap[className] = classNode;
        items.push(classNode);
    }

    // 处理顶级函数等
    const topRegex = /\/\*\*([\s\S]*?)\*\/\s*(export\s+)?(async\s+)?(function|const|let|var)\s+([\w$]+)/g;
    while ((match = topRegex.exec(text)) !== null) {
        const [, comment, , , type, name] = match;
        // 跳过已被 class 处理的内容
        if (Object.values(classMap).some(cls => match!.index > text.indexOf(cls.description))) continue;
        const line = text.slice(0, match.index).split('\n').length - 1;
        const lines = comment.split('\n').map(l => l.replace(/^\s*\* ?/, '').trim());
        const summary = lines.find(l => l && !l.startsWith('@')) || '';
        const tags = lines.filter(l => l.startsWith('@')).join('\n');
        const signature = `${type} ${name}`;
        items.push({
            label: summary,
            description: signature,
            tooltip: tags,
            line
        });
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
