// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import { l10n } from 'vscode';

// 支持树结构的节点类型
interface JSDocNode {
    label: string; // summary
    description: string; // 签名
    tooltip: string; // @项
    line: number;
    children?: JSDocNode[];
    parent?: JSDocNode; // 新增
}

class JSDocTreeItem extends vscode.TreeItem {
    parent?: JSDocTreeItem;
    constructor(
        public readonly node: JSDocNode,
        parent: JSDocTreeItem | undefined,
        extensionUri: vscode.Uri
    ) {
        super(node.label, node.children && node.children.length > 0 ? vscode.TreeItemCollapsibleState.Collapsed : vscode.TreeItemCollapsibleState.None);
        this.description = node.description;
        this.tooltip = node.tooltip;
        this.command = {
            command: 'xzynine-jsdoc-comment-outline.revealLine',
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

class JSDocOutlineProvider implements vscode.TreeDataProvider<JSDocTreeItem> {
    private _onDidChangeTreeData: vscode.EventEmitter<JSDocTreeItem | undefined | void> = new vscode.EventEmitter<JSDocTreeItem | undefined | void>();
    readonly onDidChangeTreeData: vscode.Event<JSDocTreeItem | undefined | void> = this._onDidChangeTreeData.event;
    private items: JSDocNode[] = [];
    private itemMap: Map<string, JSDocTreeItem> = new Map(); // key: line+label

    constructor(private extensionUri: vscode.Uri) {}

    refresh(items: JSDocNode[]): void {
        this.items = items;
        this.itemMap.clear();
        // 递归缓存所有 TreeItem，并设置 parent
        const cache = (nodes: JSDocNode[], parentItem?: JSDocTreeItem) => {
            for (const n of nodes) {
                n.parent = parentItem?.node;
                const item = new JSDocTreeItem(n, parentItem, this.extensionUri);
                this.itemMap.set(`${n.line}|${n.label}`, item);
                if (n.children) cache(n.children, item);
            }
        };
        cache(items);
        this._onDidChangeTreeData.fire();
    }

    getTreeItem(element: JSDocTreeItem): vscode.TreeItem {
        element.contextValue = 'jsdocItem';
        return element;
    }

    getChildren(element?: JSDocTreeItem): Thenable<JSDocTreeItem[]> {
        if (!element) {
            return Promise.resolve(this.items.map(n => this.itemMap.get(`${n.line}|${n.label}`)!));
        }
        if (element.node.children) {
            return Promise.resolve(element.node.children.map(n => this.itemMap.get(`${n.line}|${n.label}`)!));
        }
        return Promise.resolve([]);
    }

    // 返回同一行所有节点，优先最深层
    getTreeItemsByLine(line: number): JSDocTreeItem[] {
        return Array.from(this.itemMap.values()).filter(item => item.node.line === line);
    }

    getParent(element: JSDocTreeItem): JSDocTreeItem | undefined {
        if (!element.parent) return undefined;
        return this.itemMap.get(`${element.parent.node.line}|${element.parent.node.label}`);
    }

    // 公开 itemMap 只读访问器，便于外部访问
    public getItemMap(): ReadonlyMap<string, JSDocTreeItem> {
        return this.itemMap;
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
    function processSymbol(symbol: vscode.DocumentSymbol): JSDocNode {
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
        let label: string;
        let description: string;
        let tooltip: string;
        if (jsdoc) {
            // 解析 JSDoc 内容
            const comment = jsdoc.replace(/^\/\*\*|\*\/$/g, '').split('\n').map(l => l.replace(/^\s*\* ?/, '').trim());
            const summary = comment.find(l => l && !l.startsWith('@')) || '';
            const tags = comment.filter(l => l.startsWith('@')).join('\n');
            label = summary;
            description = symbol.name + (symbol.detail ? ' ' + symbol.detail : '');
            tooltip = tags;
        } else {
            label = symbol.name;
            description = '';
            tooltip = '';
        }
        const node: JSDocNode = {
            label,
            description,
            tooltip,
            line: symbol.range.start.line,
        };
        if (symbol.children && symbol.children.length > 0) {
            const children = symbol.children.map(processSymbol).filter(Boolean) as JSDocNode[];
            if (children.length > 0) node.children = children;
        }
        return node;
    }
    // 所有 symbol 都收录
    const result: JSDocNode[] = symbols.map(processSymbol);
    return result;
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

    const outlineProvider = new JSDocOutlineProvider(context.extensionUri);
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

    // 移除复制单个节点标题与描述的命令注册
    // 移除复制全部节点标题与描述的命令注册

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
        function isAncestorOrSelf(target: JSDocTreeItem, node: JSDocTreeItem): boolean {
            let p: JSDocTreeItem | undefined = node;
            while (p) {
                if (p === target) return true;
                p = p.parent;
            }
            return false;
        }
        function isDescendantOrSelf(target: JSDocTreeItem, node: JSDocTreeItem): boolean {
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
