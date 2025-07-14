// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import { l10n } from 'vscode';

// 支持树结构的节点类型，重命名为通用 DocNode
interface DocNode {
    label: string; // summary
    description: string; // 签名
    tooltip: string; // @项
    line: number;
    language: string; // 新增：语言类型
    children?: DocNode[];
    parent?: DocNode;
}

class DocTreeItem extends vscode.TreeItem {
    parent?: DocTreeItem;
    constructor(
        public readonly node: DocNode,
        parent: DocTreeItem | undefined,
        extensionUri: vscode.Uri
    ) {
        super(node.label, node.children && node.children.length > 0 ? vscode.TreeItemCollapsibleState.Collapsed : vscode.TreeItemCollapsibleState.None);
        this.description = node.description;
        this.tooltip = node.tooltip;
        this.command = {
            command: 'dos-comment-map.revealLine',
            title: '',
            arguments: [node.line]
        };
        this.parent = parent;
        // 设置不同层级的彩色图标，循环使用 3 种颜色
        let level = 1;
        let p = parent;
        while (p) {
            level++;
            p = p.parent;
        }
        const colorIdx = ((level - 1) % 3) + 1;
        this.iconPath = {
            light: vscode.Uri.joinPath(extensionUri, 'media', `jsdoc-level${colorIdx}.svg`),
            dark: vscode.Uri.joinPath(extensionUri, 'media', `jsdoc-level${colorIdx}.svg`)
        };
    }
}

class DocOutlineProvider implements vscode.TreeDataProvider<DocTreeItem> {
    private _onDidChangeTreeData: vscode.EventEmitter<DocTreeItem | undefined | void> = new vscode.EventEmitter<DocTreeItem | undefined | void>();
    readonly onDidChangeTreeData: vscode.Event<DocTreeItem | undefined | void> = this._onDidChangeTreeData.event;
    private items: DocNode[] = [];
    private itemMap: Map<string, DocTreeItem> = new Map(); // key: line+label

    constructor(private extensionUri: vscode.Uri) {}

    refresh(items: DocNode[]): void {
        this.items = items;
        this.itemMap.clear();
        // 递归缓存所有 TreeItem，并设置 parent
        const cache = (nodes: DocNode[], parentItem?: DocTreeItem) => {
            for (const n of nodes) {
                const item = new DocTreeItem(n, parentItem, this.extensionUri);
                this.itemMap.set(`${n.line}-${n.label}`, item);
                if (n.children) cache(n.children, item);
            }
        };
        cache(this.items);
        this._onDidChangeTreeData.fire();
    }

    getTreeItem(element: DocTreeItem): vscode.TreeItem {
        element.contextValue = 'docItem';
        return element;
    }

    getChildren(element?: DocTreeItem): Thenable<DocTreeItem[]> {
        if (!element) {
            return Promise.resolve(this.items.map(n => this.itemMap.get(`${n.line}-${n.label}`)!));
        }
        if (element.node.children) {
            return Promise.resolve(element.node.children.map(n => this.itemMap.get(`${n.line}-${n.label}`)!));
        }
        return Promise.resolve([]);
    }

    getTreeItemsByLine(line: number): DocTreeItem[] {
        return Array.from(this.itemMap.values()).filter(item => item.node.line === line);
    }

    getParent(element: DocTreeItem): DocTreeItem | undefined {
        return element.parent;
    }

    public getItemMap(): ReadonlyMap<string, DocTreeItem> {
        return this.itemMap;
    }
}

// 解析 doc 注释，支持多语言
async function generateDocOutlineFromSymbols(document: vscode.TextDocument): Promise<DocNode[]> {
    const languageId = document.languageId;
    // TODO: 按 languageId 调用对应编译器/工具解析注释
    // 目前仅保留原 JSDoc 逻辑，后续扩展
    const symbols = await vscode.commands.executeCommand<vscode.DocumentSymbol[]>(
        'vscode.executeDocumentSymbolProvider',
        document.uri
    );
    if (!symbols) return [];
    function processSymbol(symbol: vscode.DocumentSymbol): DocNode {
        // 获取 symbol 前的 doc 注释
        let doc = '';
        let i = symbol.range.start.line - 1;
        while (i >= 0) {
            const lineText = document.lineAt(i).text.trim();
            if (lineText.startsWith('/**') || lineText.startsWith('///') || lineText.startsWith('"""') || lineText.startsWith('<!--')) {
                let commentLines = [lineText];
                let j = i + 1;
                while (j < symbol.range.start.line) {
                    commentLines.push(document.lineAt(j).text.trim());
                    j++;
                }
                doc = commentLines.join('\n');
                break;
            }
            i--;
        }
        // 解析注释内容（可按语言扩展）
        const comment = doc.replace(/^\/\*\*|\*\/$/g, '').split('\n').map(l => l.replace(/^\s*\* ?/, '').trim());
        return {
            label: symbol.name,
            description: symbol.detail,
            tooltip: comment.join(' '),
            line: symbol.range.start.line,
            language: languageId,
            children: symbol.children?.map(processSymbol)
        };
    }
    return symbols.map(processSymbol);
}

function getSupportedDocLanguages(): string[] {
    // VS Code 默认支持的主流 doc 注释语言
    // 只要 VS Code 能提供 DocumentSymbolProvider，理论上都可支持
    return [
        'javascript',      // JSDoc
        'typescript',      // JSDoc
        'java',            // Javadoc
        'python',          // docstring
        'csharp',          // XML comments
        'cpp',             // Doxygen
        'c',               // Doxygen
        'go',              // Go doc
        'php',             // PHPDoc
        'ruby',            // RDoc
        'swift',           // Swift doc
        'kotlin',          // KDoc
        'scala',           // Scaladoc
        'rust',            // Rust doc
        'dart',            // Dart doc
        'objective-c',     // Doxygen
        'typescriptreact', // JSDoc
        'javascriptreact', // JSDoc
    ];
}

export function activate(context: vscode.ExtensionContext) {

	// 使用控制台输出诊断信息 (console.log) 和错误 (console.error)
	// 这行代码只会在扩展激活时执行一次
	console.log(l10n.t('extension.activated', '恭喜，您的扩展 "xzynine-jsdoc-comment-outline" 已激活！'));

	// 该命令已在 package.json 文件中定义
	// 现在使用 registerCommand 提供命令的实现
	// commandId 参数必须与 package.json 中的 command 字段匹配
	const disposable = vscode.commands.registerCommand('xzynine-jsdoc-comment-outline.helloWorld', () => {
		// 每次命令执行时会运行这里的代码
		// 向用户显示消息框
		vscode.window.showInformationMessage(l10n.t('command.hello'));
	});

	context.subscriptions.push(disposable);

    const outlineProvider = new DocOutlineProvider(context.extensionUri);
    const treeView = vscode.window.createTreeView('jsdocCommentOutline', {
        treeDataProvider: outlineProvider,
        showCollapseAll: true
    });

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
        const supported = getSupportedDocLanguages();
        if (editor && supported.includes(editor.document.languageId)) {
            generateDocOutlineFromSymbols(editor.document).then(items => {
                outlineProvider.refresh(items);
            });
        } else {
            outlineProvider.refresh([]);
        }
    }

    vscode.window.onDidChangeActiveTextEditor(updateOutline, null, context.subscriptions);
    vscode.workspace.onDidChangeTextDocument(e => {
        const editor = vscode.window.activeTextEditor;
        if (editor && e.document === editor.document) {
            updateOutline();
        }
    }, null, context.subscriptions);
    vscode.languages.onDidChangeDiagnostics(() => {
        updateOutline();
    }, null, context.subscriptions);

    // 监听选区变化，自动高亮并展开大纲树对应节点
    vscode.window.onDidChangeTextEditorSelection(e => {
        const editor = vscode.window.activeTextEditor;
        if (!editor || e.textEditor !== editor) return;
        const line = editor.selection.active.line;
        // 优先选最深层节点
        const treeItems = outlineProvider.getTreeItemsByLine(line);
        if (treeItems.length > 0) {
            const treeItem = treeItems[treeItems.length - 1];
            // 只高亮，不聚焦树视图，避免打断编辑器操作
            treeView.reveal(treeItem, { select: true, focus: false, expand: true });
        }
    }, null, context.subscriptions);
    updateOutline();

    // 监听大纲树节点展开事件，实现点击只展开当前节点及其子项，收起其他
    treeView.onDidExpandElement(async (e) => {
        // 使用 getItemMap 访问 itemMap
        const expandedItems = Array.from(outlineProvider.getItemMap().values()).filter(item => item.collapsibleState === vscode.TreeItemCollapsibleState.Expanded);
        // 递归收起除当前节点及其祖先、子孙外的所有节点
        function isAncestorOrSelf(target: DocTreeItem, node: DocTreeItem): boolean {
            let p: DocTreeItem | undefined = node;
            while (p) {
                if (p === target) return true;
                p = p.parent;
            }
            return false;
        }
        function isDescendantOrSelf(target: DocTreeItem, node: DocTreeItem): boolean {
            if (target === node) return true;
            if (!target.node.children) return false;
            return target.node.children.some(child => {
                const childItem = outlineProvider.getItemMap().get(`${child.line}|${child.label}`);
                return childItem && isDescendantOrSelf(childItem, node);
            });
        }
        for (const item of expandedItems) {
            if (!isAncestorOrSelf(e.element, item) && !isDescendantOrSelf(e.element, item)) {
                // 收起
                treeView.reveal(item, { expand: false });
            }
        }
    });
    // 默认展开所有一级节点
    setTimeout(() => {
        outlineProvider.getChildren().then(children => {
            children.forEach(child => {
                treeView.reveal(child, { expand: 2 }); // 展开两级
            });
        });
    }, 500);
}

// This method is called when your extension is deactivated
export function deactivate() {}
