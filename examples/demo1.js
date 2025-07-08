/**
 * 这是一个加法函数
 * @param {number} a 第一个加数
 * @param {number} b 第二个加数
 * @returns {number} 和
 */
function add(a, b) {
    return a + b;
}

/**
 * 表示一个人
 * @class
 * @property {string} name 姓名
 */
class Person {
    /**
     * 创建一个新的人
     * @param {string} name 姓名
     */
    constructor(name) {
        this.name = name;
    }

    /**
     * 打招呼
     */
    greet() {
        console.log('Hello, ' + this.name);
    }
}

/**
 * 异步获取数据
 * @returns {Promise<string>}
 */
async function fetchData() {
    return 'data';
}