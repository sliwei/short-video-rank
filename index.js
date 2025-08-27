const fs = require('fs');
const https = require('https');
const { parse } = require('csv-parse');

// 配置参数
const API_CONFIG = {
    baseUrl: 'https://playlet-applet.dataeye.com/playlet/listHotRanking',
    defaultParams: {
        pageId: 1,
        pageSize: 30,
        month: '2025-01'
    }
};

const CSV_FILE_PATH = './短剧.csv';

/**
 * 调用listHotRanking接口获取数据
 * @param {Object} params - 接口参数
 * @returns {Promise<Object>} API响应数据
 */
function fetchHotRanking(params = {}) {
    return new Promise((resolve, reject) => {
        const queryParams = { ...API_CONFIG.defaultParams, ...params };
        const queryString = new URLSearchParams(queryParams).toString();
        const url = `${API_CONFIG.baseUrl}?${queryString}`;
        
        console.log(`正在调用接口: ${url}`);
        
        https.get(url, (res) => {
            let data = '';
            
            res.on('data', (chunk) => {
                data += chunk;
            });
            
            res.on('end', () => {
                try {
                    const jsonData = JSON.parse(data);
                    resolve(jsonData);
                } catch (error) {
                    reject(new Error(`解析JSON失败: ${error.message}`));
                }
            });
        }).on('error', (error) => {
            reject(new Error(`请求失败: ${error.message}`));
        });
    });
}

/**
 * 读取并解析CSV文件
 * @returns {Promise<Array>} CSV数据数组
 */
function readCSVFile() {
    return new Promise((resolve, reject) => {
        const results = [];
        
        if (!fs.existsSync(CSV_FILE_PATH)) {
            reject(new Error(`CSV文件不存在: ${CSV_FILE_PATH}`));
            return;
        }
        
        console.log('正在读取CSV文件...');
        
        fs.createReadStream(CSV_FILE_PATH)
            .pipe(parse({
                delimiter: ',',
                skip_empty_lines: true,
                relax_column_count: true
            }))
            .on('data', (row) => {
                if (row.length >= 2) {
                    // 第一列是剧名信息，第二列是quark链接
                    const playletInfo = row[0] || '';
                    const quarkUrl = row[1] || '';
                    
                    if (playletInfo && quarkUrl && quarkUrl.includes('pan.quark.cn')) {
                        results.push({
                            playletInfo,
                            quarkUrl: quarkUrl.trim()
                        });
                    }
                }
            })
            .on('end', () => {
                console.log(`CSV文件读取完成，共找到 ${results.length} 条记录`);
                resolve(results);
            })
            .on('error', (error) => {
                reject(new Error(`读取CSV文件失败: ${error.message}`));
            });
    });
}

/**
 * 从剧名信息中提取可能的剧名
 * @param {string} playletInfo - 剧名信息字符串
 * @returns {Array<string>} 可能的剧名数组
 */
function extractPlayletNames(playletInfo) {
    const names = [];
    
    // 按&分割，获取多个可能的剧名
    const parts = playletInfo.split('&');
    
    parts.forEach(part => {
        // 移除编号前缀 (如: 32019-)
        let cleanName = part.replace(/^\d+-/, '');
        
        // 移除括号及其内容 (如: （71集）)
        cleanName = cleanName.replace(/[（(].*?[）)]/g, '');
        
        // 移除演员信息 (通常在最后，用&分隔)
        cleanName = cleanName.split(/[&，,]/)[0];
        
        // 清理空格和特殊字符
        cleanName = cleanName.trim().replace(/[！!？?。.]/g, '');
        
        if (cleanName) {
            names.push(cleanName);
        }
    });
    
    return names;
}

/**
 * 在CSV数据中查找匹配的quark链接
 * @param {string} playletName - 要查找的剧名
 * @param {Array} csvData - CSV数据
 * @returns {string|null} 匹配的quark链接或null
 */
function findQuarkUrl(playletName, csvData) {
    for (const item of csvData) {
        const possibleNames = extractPlayletNames(item.playletInfo);
        
        // 精确匹配
        if (possibleNames.some(name => name === playletName)) {
            return item.quarkUrl;
        }
        
        // 模糊匹配 - 检查是否包含关键词
        if (possibleNames.some(name => 
            name.includes(playletName) || playletName.includes(name)
        )) {
            return item.quarkUrl;
        }
    }
    
    return null;
}

/**
 * 主函数
 * @param {Object} apiParams - API参数
 */
async function main(apiParams = {}) {
    try {
        console.log('=== 短剧Quark链接查找工具 ===\n');
        
        // 读取CSV数据
        const csvData = await readCSVFile();
        
        // 调用API获取热门排行数据
        const apiResponse = await fetchHotRanking(apiParams);
        
        if (!apiResponse.content || !Array.isArray(apiResponse.content)) {
            throw new Error('API响应格式错误或无内容');
        }
        
        console.log(`\n获取到 ${apiResponse.content.length} 条热门短剧数据\n`);
        console.log('=== 匹配结果 ===\n');
        
        const results = [];
        let foundCount = 0;
        
        // 处理每个短剧
        for (const item of apiResponse.content) {
            const playletName = item.playletName;
            const quarkUrl = findQuarkUrl(playletName, csvData);
            
            const result = {
                ranking: item.ranking,
                playletName: playletName,
                quarkUrl: quarkUrl || '未找到'
            };
            
            results.push(result);
            
            if (quarkUrl) {
                foundCount++;
                console.log(`✅ 排名${item.ranking}: ${playletName}`);
                console.log(`   Quark链接: ${quarkUrl}\n`);
            } else {
                console.log(`❌ 排名${item.ranking}: ${playletName}`);
                console.log(`   Quark链接: 未找到\n`);
            }
        }
        
        console.log('=== 统计信息 ===');
        console.log(`总共查询: ${results.length} 部短剧`);
        console.log(`找到链接: ${foundCount} 部短剧`);
        console.log(`匹配率: ${((foundCount / results.length) * 100).toFixed(1)}%`);
        
        // 保存结果到文件
        const outputFile = 'matching_results.json';
        fs.writeFileSync(outputFile, JSON.stringify(results, null, 2), 'utf8');
        console.log(`\n结果已保存到: ${outputFile}`);
        
        return results;
        
    } catch (error) {
        console.error('执行失败:', error.message);
        process.exit(1);
    }
}

// 如果直接运行此脚本
if (require.main === module) {
    // 可以通过命令行参数自定义API参数
    const args = process.argv.slice(2);
    const apiParams = {};
    
    // 解析命令行参数
    for (let i = 0; i < args.length; i += 2) {
        if (args[i].startsWith('--')) {
            const key = args[i].substring(2);
            const value = args[i + 1];
            
            if (key === 'pageId' || key === 'pageSize') {
                apiParams[key] = parseInt(value);
            } else {
                apiParams[key] = value;
            }
        }
    }
    
    console.log('使用参数:', { ...API_CONFIG.defaultParams, ...apiParams });
    main(apiParams);
}

module.exports = {
    fetchHotRanking,
    readCSVFile,
    findQuarkUrl,
    main
};