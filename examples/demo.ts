/**
 * 计算阶乘
 * @param n 数字
 * @returns 阶乘结果
 */
export function factorial(n: number): number {
    if (n <= 1) return 1;
    return n * factorial(n - 1);
}

/**
 * 工具类
 */
export class Util {
    /**
     * 反转字符串
     * @param str 输入字符串
     * @returns 反转结果
     */
    static reverse(str: string): string {
        return str.split('').reverse().join('');
    }
}
