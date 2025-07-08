"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Util = void 0;
exports.factorial = factorial;
/**
 * 计算阶乘
 * @param n 数字
 * @returns 阶乘结果
 */
function factorial(n) {
    if (n <= 1)
        return 1;
    return n * factorial(n - 1);
}
/**
 * 工具类
 */
class Util {
    /**
     * 反转字符串
     * @param str 输入字符串
     * @returns 反转结果
     */
    static reverse(str) {
        return str.split('').reverse().join('');
    }
}
exports.Util = Util;
//# sourceMappingURL=demo.js.map