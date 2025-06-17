# 影视采集接口测速工具

这是一个用于测试影视采集接口速度和稳定性的工具。通过批量测试多个采集接口的响应时间、成功率和结果数量，帮助您选择最适合的影视数据源。

## 功能特点

- 批量测试多个采集接口的速度和稳定性
- 支持 JSON 和 XML 格式的采集接口
- 自动重试失败的请求
- 统计每个接口的响应时间、成功率和结果数量
- 测试每个搜索结果的多个流媒体链接的可用性和速度
- 根据综合评分对接口进行排序，可自定义权重
- 生成详细的 HTML 和 JSON 格式报告

## html测速报告示例
[测速报告](https://bucket-2010-2715.nb-1s.enzonix.com/speed-test-report-2025-06-17T09-20-46-450Z.html)

## 使用方法

### 安装

```bash
git clone https://github.com/fish2018/yingsu.git
cd yingsu
npm install
```

### 配置

编辑 `config.js` 文件，根据您的需求配置测试参数：

```javascript
module.exports = {
  // 采集接口配置列表
  apiList: [
    {
      name: "接口名称",
      api: "接口地址",
      isXml: false  // 是否为XML格式，默认为false（JSON格式）
    },
    // 更多接口...
  ],
  
  // 测速配置
  speedTestConfig: {
    timeout: 10000,         // 请求超时时间（毫秒）
    retryCount: 3,          // 失败重试次数
    concurrentRequests: 3,  // 并发请求数
    testTypes: [
      {
        name: "搜索测试",
        enabled: true,
        keywords: ["柯南", "龙珠", "火影", "瑞克和莫蒂", "宝可梦"]  // 测试关键词
      },
      {
        name: "详情测试",
        enabled: true
      },
      {
        name: "流媒体测试",
        enabled: true,
        testMethod: "HEAD",           // HEAD或GET，HEAD只测试响应时间，GET会下载部分内容
        maxStreamTestSize: 1024 * 1024, // 使用GET方法时，最大下载字节数（1MB）
        testResultCount: 5,           // 测试每个搜索结果的前几个视频链接，默认为5个
        maxTimeout: 15000             // 流媒体链接测试的超时时间（毫秒）
      }
    ],
    
    // 排序配置
    rankingConfig: {
      // 各项指标的权重（总和为1）
      weights: {
        searchTime: 0.10,    // 搜索响应时间权重
        detailTime: 0.05,    // 详情响应时间权重
        streamTime: 0.50,    // 流媒体响应时间权重（播放速度）
        successRate: 0.20,   // 成功率权重
        resultCount: 0.15    // 搜索结果数量权重
      },
      
      // 是否优先考虑成功率
      prioritizeSuccessRate: false,
      successRateThreshold: 80  // 成功率阈值（百分比）
    }
  }
};
```

### 运行测试

```bash
npm start
```

测试完成后，将在 `reports` 目录下生成 HTML 和 JSON 格式的报告。

## 配置说明

### 采集接口配置

每个采集接口需要配置以下参数：

- `name`：接口名称（必填）
- `api`：接口地址（必填）
- `isXml`：是否为XML格式，默认为false（JSON格式）

### 测速配置

- `timeout`：请求超时时间（毫秒）
- `retryCount`：失败重试次数
- `concurrentRequests`：并发请求数

### 测试类型

1. **搜索测试**
   - `keywords`：用于测试的关键词列表

2. **详情测试**
   - 使用搜索结果的ID进行测试

3. **流媒体测试**
   - `testMethod`：测试方法，HEAD（只测试响应时间）或GET（下载部分内容）
   - `maxStreamTestSize`：使用GET方法时，最大下载字节数
   - `testResultCount`：测试每个搜索结果的前几个视频链接数量，默认为5个
   - `maxTimeout`：流媒体链接测试的超时时间（毫秒）

### 排序配置

- `weights`：各项指标的权重（总和为1）
  - `searchTime`：搜索响应时间权重（默认0.05）
  - `detailTime`：详情响应时间权重（默认0.05）
  - `streamTime`：流媒体响应时间权重（默认0.50）
  - `successRate`：成功率权重（默认0.00）
  - `resultCount`：搜索结果数量权重（默认0.40）
- `prioritizeSuccessRate`：是否优先考虑成功率（默认false）
- `successRateThreshold`：成功率阈值（百分比）（默认80）

### 自定义排序权重

您可以根据自己的需求调整排序权重，例如：

- **注重播放速度**：增加 `streamTime` 权重
- **注重搜索结果数量**：增加 `resultCount` 权重
- **注重搜索速度**：增加 `searchTime` 权重
- **注重详情页速度**：增加 `detailTime` 权重
- **注重稳定性**：增加 `successRate` 权重并设置 `prioritizeSuccessRate` 为 `true`

## 注意事项

- 测试结果仅供参考，实际使用体验可能因网络环境、服务器负载等因素而异
- 建议定期进行测试，以获取最新的接口性能数据
- 部分接口可能有访问频率限制，请合理设置并发请求数和重试次数
- 流媒体链接测试可能会消耗较多流量，请注意网络使用情况

### 执行效果

```
开始测试采集接口速度...
共有 23 个接口需要测试

#################### 1: 魔爪###############################

测试接口: 魔爪 (https://mozhuazy.com/api.php/provide/vod/)
  测试搜索功能...

==============================================

    关键词: 柯南
    响应时间: 1048ms, 结果数量: 20
    测试第一个结果详情: 名侦探柯南 日语版 (ID: 11756)
    详情响应时间: 786ms
    找到 1221 个流媒体链接，测试前 5 个链接...

--------------------------------
      测试链接 1/5: https://mzm3u8.com/20250219/MnxdaMFy/index.m3u8
      发现嵌套的M3U8文件: https://mzm3u8.com/20250219/MnxdaMFy/1100kb/hls/index.m3u8
      找到真实媒体文件链接: https://m2.oyzns.com/20250219/MnxdaMFy/1100kb/hls/Y3jGQpt5.jpg
      媒体文件大小: 76528 字节, 下载时间: 117ms
      响应时间: 381ms, 下载速度: 638.75 KB/s

--------------------------------
      测试链接 2/5: https://mzm3u8.com/20250219/FVLW1uiA/index.m3u8
      发现嵌套的M3U8文件: https://mzm3u8.com/20250219/FVLW1uiA//1100kb/hls/index.m3u8
      找到真实媒体文件链接: https://m2.oyzns.com/20250219/FVLW1uiA/1100kb/hls/YRnX7yp7.jpg
      媒体文件大小: 871200 字节, 下载时间: 191ms
      响应时间: 1314ms, 下载速度: 4.35 MB/s

--------------------------------
      测试链接 3/5: https://mzm3u8.com/20250219/lRjZhgWC/index.m3u8
      发现嵌套的M3U8文件: https://mzm3u8.com/20250219/lRjZhgWC/1100kb/hls/index.m3u8
      找到真实媒体文件链接: https://m2.oyzns.com/20250219/lRjZhgWC/1100kb/hls/iQ0ps6OS.jpg
      媒体文件大小: 33280 字节, 下载时间: 59ms
      响应时间: 441ms, 下载速度: 550.85 KB/s

--------------------------------
      测试链接 4/5: https://mzm3u8.com/20250219/kGG0hU10/index.m3u8
      发现嵌套的M3U8文件: https://mzm3u8.com/20250219/kGG0hU10/1100kb/hls/index.m3u8
      找到真实媒体文件链接: https://m2.oyzns.com/20250219/kGG0hU10/1100kb/hls/fFNkCEY2.jpg
      媒体文件大小: 425824 字节, 下载时间: 215ms
      响应时间: 344ms, 下载速度: 1.89 MB/s

--------------------------------
      测试链接 5/5: https://mzm3u8.com/20250219/i7BX1YsA/index.m3u8
      发现嵌套的M3U8文件: https://mzm3u8.com/20250219/i7BX1YsA//1100kb/hls/index.m3u8
      找到真实媒体文件链接: https://m2.oyzns.com/20250219/i7BX1YsA/1100kb/hls/Hf4pbL8J.jpg
      媒体文件大小: 414736 字节, 下载时间: 213ms
      响应时间: 306ms, 下载速度: 1.86 MB/s

    流媒体链接平均响应时间: 557ms (5/5 成功), 平均下载速度: 1.85 MB/s (5/5 个链接成功测速)

==============================================

    关键词: 龙珠
    响应时间: 918ms, 结果数量: 6
    测试第一个结果详情: 龙珠大魔 (ID: 9931)
    详情响应时间: 733ms
    找到 20 个流媒体链接，测试前 5 个链接...

--------------------------------
      测试链接 1/5: https://mzm3u8.vip/20250210/ImKxveIQ/index.m3u8
      发现嵌套的M3U8文件: https://mzm3u8.vip/20250210/ImKxveIQ/1100kb/hls/index.m3u8
      找到真实媒体文件链接: https://m1.oyzns.com/20250210/ImKxveIQ/1100kb/hls/MeaLxc0O.jpg
      媒体文件大小: 405152 字节, 下载时间: 238ms
      响应时间: 306ms, 下载速度: 1.62 MB/s

--------------------------------
      测试链接 2/5: https://mzm3u8.vip/20250210/Fm2aeaLH/index.m3u8
      发现嵌套的M3U8文件: https://mzm3u8.vip/20250210/Fm2aeaLH/1100kb/hls/index.m3u8
      找到真实媒体文件链接: https://m1.oyzns.com/20250210/Fm2aeaLH/1100kb/hls/WlPneGLp.jpg
      媒体文件大小: 397248 字节, 下载时间: 141ms
      响应时间: 274ms, 下载速度: 2.69 MB/s

--------------------------------
      测试链接 3/5: https://mzm3u8.vip/20250210/3zpfU0XU/index.m3u8
      发现嵌套的M3U8文件: https://mzm3u8.vip/20250210/3zpfU0XU/1100kb/hls/index.m3u8
      找到真实媒体文件链接: https://m1.oyzns.com/20250210/3zpfU0XU/1100kb/hls/bO3qPfVr.jpg
      媒体文件大小: 401008 字节, 下载时间: 1196ms
      响应时间: 269ms, 下载速度: 327.43 KB/s

--------------------------------
      测试链接 4/5: https://mzm3u8.vip/20250210/iay5QkJ9/index.m3u8
      发现嵌套的M3U8文件: https://mzm3u8.vip/20250210/iay5QkJ9/1100kb/hls/index.m3u8
      找到真实媒体文件链接: https://m1.oyzns.com/20250210/iay5QkJ9/1100kb/hls/UGM5rvKp.jpg
      媒体文件大小: 401200 字节, 下载时间: 116ms
      响应时间: 339ms, 下载速度: 3.30 MB/s

--------------------------------
      测试链接 5/5: https://mzm3u8.vip/20250210/H2kCFoK8/index.m3u8
      发现嵌套的M3U8文件: https://mzm3u8.vip/20250210/H2kCFoK8/1100kb/hls/index.m3u8
      找到真实媒体文件链接: https://m1.oyzns.com/20250210/H2kCFoK8/1100kb/hls/n7HomCJl.jpg
      媒体文件大小: 620416 字节, 下载时间: 232ms
      响应时间: 302ms, 下载速度: 2.55 MB/s

    流媒体链接平均响应时间: 298ms (5/5 成功), 平均下载速度: 2.10 MB/s (5/5 个链接成功测速)

==============================================

    关键词: 火影
    响应时间: 860ms, 结果数量: 6
    测试第一个结果详情: 火影 (ID: 15586)
    详情响应时间: 769ms
    找到 1 个流媒体链接，测试前 1 个链接...

--------------------------------
      测试链接 1/1: https://mzm3u8.vip/20250329/4W2tzUuK/index.m3u8
      发现嵌套的M3U8文件: https://mzm3u8.vip/20250329/4W2tzUuK/2000kb/hls/index.m3u8
      找到真实媒体文件链接: https://m1.oyzns.com/20250329/4W2tzUuK/2000kb/hls/xCO910vJ.jpg
      媒体文件大小: 92128 字节, 下载时间: 911ms
      响应时间: 342ms, 下载速度: 98.76 KB/s

    流媒体链接平均响应时间: 342ms (1/1 成功), 平均下载速度: 98.76 KB/s (1/1 个链接成功测速)

==============================================

    关键词: 瑞克和莫蒂
    响应时间: 950ms, 结果数量: 9
    测试第一个结果详情: 瑞克和莫蒂 第八季 (ID: 21317)
    详情响应时间: 791ms
    找到 3 个流媒体链接，测试前 3 个链接...

--------------------------------
      测试链接 1/3: https://mzm3u8.vip/20250525/N3E5pCkt/index.m3u8
      发现嵌套的M3U8文件: https://mzm3u8.vip/20250525/N3E5pCkt/3494kb/hls/index.m3u8
      找到真实媒体文件链接: https://m1.oyzns.com/20250525/N3E5pCkt/3494kb/hls/0GvrKdKc.jpg
      媒体文件大小: 58096 字节, 下载时间: 146ms
      响应时间: 298ms, 下载速度: 388.59 KB/s

--------------------------------
      测试链接 2/3: https://mzm3u8.com/20250609/90kjopi5/index.m3u8
      发现嵌套的M3U8文件: https://mzm3u8.com/20250609/90kjopi5/3489kb/hls/index.m3u8
      找到真实媒体文件链接: https://m2.oyzns.com/20250609/90kjopi5/3489kb/hls/WYkeNhme.jpg
      媒体文件大小: 58096 字节, 下载时间: 220ms
      响应时间: 378ms, 下载速度: 257.88 KB/s

--------------------------------
      测试链接 3/3: https://mzm3u8.com/20250609/UlkOXENp/index.m3u8
      发现嵌套的M3U8文件: https://mzm3u8.com/20250609/UlkOXENp/3490kb/hls/index.m3u8
      找到真实媒体文件链接: https://m2.oyzns.com/20250609/UlkOXENp/3490kb/hls/CgBqCcwj.jpg
      媒体文件大小: 58096 字节, 下载时间: 56ms
      响应时间: 600ms, 下载速度: 1013.11 KB/s

    流媒体链接平均响应时间: 425ms (3/3 成功), 平均下载速度: 553.20 KB/s (3/3 个链接成功测速)

==============================================

    关键词: 宝可梦
    响应时间: 942ms, 结果数量: 17
    测试第一个结果详情: 宝可梦 地平线 (ID: 11566)
    详情响应时间: 720ms
    找到 98 个流媒体链接，测试前 5 个链接...

--------------------------------
      测试链接 1/5: https://mzm3u8.vip/20250217/KVoDFCgM/index.m3u8
      发现嵌套的M3U8文件: https://mzm3u8.vip/20250217/KVoDFCgM/1100kb/hls/index.m3u8
      找到真实媒体文件链接: https://m1.oyzns.com/20250217/KVoDFCgM/1100kb/hls/VoCRwSF6.jpg
      媒体文件大小: 369424 字节, 下载时间: 185ms
      响应时间: 312ms, 下载速度: 1.90 MB/s

--------------------------------
      测试链接 2/5: https://mzm3u8.vip/20250217/rXsmUt2S/index.m3u8
      发现嵌套的M3U8文件: https://mzm3u8.vip/20250217/rXsmUt2S/1100kb/hls/index.m3u8
      找到真实媒体文件链接: https://m1.oyzns.com/20250217/rXsmUt2S/1100kb/hls/jvIY183m.jpg
      媒体文件大小: 712160 字节, 下载时间: 151ms
      响应时间: 323ms, 下载速度: 4.50 MB/s

--------------------------------
      测试链接 3/5: https://mzm3u8.vip/20250217/Pn8HCS6l/index.m3u8
      发现嵌套的M3U8文件: https://mzm3u8.vip/20250217/Pn8HCS6l/1100kb/hls/index.m3u8
      找到真实媒体文件链接: https://m1.oyzns.com/20250217/Pn8HCS6l/1100kb/hls/MJtfXJoh.jpg
      媒体文件大小: 220352 字节, 下载时间: 96ms
      响应时间: 369ms, 下载速度: 2.19 MB/s

--------------------------------
      测试链接 4/5: https://mzm3u8.vip/20250217/s9okFLd5/index.m3u8
      发现嵌套的M3U8文件: https://mzm3u8.vip/20250217/s9okFLd5/1100kb/hls/index.m3u8
      找到真实媒体文件链接: https://m1.oyzns.com/20250217/s9okFLd5/1100kb/hls/bdfBbabr.jpg
      媒体文件大小: 492384 字节, 下载时间: 151ms
      响应时间: 316ms, 下载速度: 3.11 MB/s

--------------------------------
      测试链接 5/5: https://mzm3u8.vip/20250217/wH07etkw/index.m3u8
      发现嵌套的M3U8文件: https://mzm3u8.vip/20250217/wH07etkw/1100kb/hls/index.m3u8
      找到真实媒体文件链接: https://m1.oyzns.com/20250217/wH07etkw/1100kb/hls/5yLAJSIC.jpg
      媒体文件大小: 568896 字节, 下载时间: 1264ms
      响应时间: 357ms, 下载速度: 439.53 KB/s

    流媒体链接平均响应时间: 335ms (5/5 成功), 平均下载速度: 2.43 MB/s (5/5 个链接成功测速)

#################### 2: 最大###############################

测试接口: 最大 (https://api.zuidapi.com/api.php/provide/vod/from/zuidam3u8/)
  测试搜索功能...

==============================================

    关键词: 柯南
    响应时间: 1009ms, 结果数量: 20
    测试第一个结果详情: 名侦探柯南 (ID: 35671)
    详情响应时间: 515ms
    找到 1069 个流媒体链接，测试前 5 个链接...

--------------------------------
      测试链接 1/5: https://v6.daayee.com/yyv6/202309/09/RJ2SjWSHRM1/video/index.m3u8
      ... ...
```
