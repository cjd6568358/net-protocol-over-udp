/**
 * 获取随机数
 * @param {Number} min
 * @param {Number} max
 * @returns Number
 */
const random = (min, max) => {
  return Math.floor(Math.random() * (max - min + 1)) + min;
};

/**
 * 字符串分割
 * @param {String} str
 * @param {Number} size
 * @returns
 */
const strChunk = (str, size) => {
  let reg = new RegExp(`\\d{1,${size}}`, "g");
  return str.match(reg);
};

export { random, strChunk };
