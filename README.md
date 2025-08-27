# 短剧Quark链接查找工具

## 功能说明
从listHotRanking接口获取热门短剧排行数据，然后在本地CSV文件中查找对应的Quark网盘链接。

## 使用方法

### 基本使用
```bash
node index.js
```

### 自定义参数
```bash
# 指定页码和每页数量
node index.js --pageId 1 --pageSize 10

# 指定月份
node index.js --month 2025-01

# 组合参数
node index.js --pageId 2 --pageSize 20 --month 2025-01
```

### 使用npm脚本
```bash
# 默认运行
npm start

# 测试运行（获取10条数据）
npm test
```

## 输出说明
- 控制台会显示匹配过程和结果
- 结果会保存到 `matching_results.json` 文件
- 包含排名、剧名和Quark链接信息

## 文件说明
- `index.js` - 主脚本文件
- `短剧.csv` - 短剧数据源文件
- `matching_results.json` - 输出结果文件
- `package.json` - 项目配置文件 