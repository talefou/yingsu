/**
 * 影视采集接口测速配置文件
 * 
 * 配置格式说明：
 * - name: 采集接口名称（必填）
 * - api: 采集接口地址（必填）
 * - isXml: 是否为XML格式，默认为false（JSON格式）
 */

module.exports = {
  // 采集接口配置列表
  apiList: [
    {
      name: "魔爪",
      api: "https://mozhuazy.com/api.php/provide/vod/",
      isXml: false
    },
    {
      name: "最大",
      api: "https://api.zuidapi.com/api.php/provide/vod/from/zuidam3u8/",
      isXml: false
    },
    {
      name: "无线",
      api: "https://api.wuxianzy.net/api.php/provide/vod/m3u8/at/json",
      isXml: false
    },
    {
      name: "速播",
      api: "https://www.subocaiji.com/api.php/provide/vod/from/subm3u8/at/xml/",
      isXml: true
    },
    {
      name: "无尽",
      api: "https://api.wujinapi.me/api.php/provide/vod/from/wjm3u8/at/xml/",
      isXml: true
    },
    {
      name: "金马",
      api: "https://api.jmzy.com/api.php/provide/vod/",
      isXml: false
    },
    {
      name: "爱奇艺",
      api: "https://iqiyizyapi.com/api.php/provide/vod",
      isXml: false
    },
    {
      name: "暴风",
      api: "https://bfzyapi.com/api.php/provide/vod/",
      isXml: false
    },
    {
      name: "黑木耳",
      api: "https://json02.heimuer.xyz/api.php/provide/vod",
      isXml: false
    },
    {
      name: "淘片",
      api: "https://taopianapi.com/cjapi/mc/vod/json/m3u8.html",
      isXml: false
    },
    {
      name: "量子",
      api: "https://cj.lziapi.com/api.php/provide/vod/from/lzm3u8/at/xml/",
      isXml: true
    },
    {
      name: "卧龙",
      api: "https://collect.wolongzy.cc/api.php/provide/vod/",
      isXml: false
    },
    {
      name: "魔都",
      api: "https://www.mdzyapi.com/api.php/provide/vod",
      isXml: false
    },
    {
      name: "非凡",
      api: "http://api.ffzyapi.com/api.php/provide/vod/from/ffm3u8/at/json/",
      isXml: false
    },
    {
      name: "爱坤",
      api: "https://ikunzy.vip/api.php/provide/vod/",
      isXml: false
    },
    {
      name: "豆瓣",
      api: "https://caiji.dbzy5.com/api.php/provide/vod/at/josn/",
      isXml: false
    },
    {
      name: "茅台",
      api: "https://caiji.maotaizy.cc/api.php/provide/vod/at/josn/",
      isXml: false
    },
    {
      name: "极速",
      api: "https://jszyapi.com/api.php/provide/vod/from/jsm3u8/at/json",
      isXml: false
    },
    {
      name: "华为",
      api: "https://cjhwba.com/api.php/provide/vod/",
      isXml: false
    },
    {
      name: "360",
      api: "https://360zy.com/api.php/provide/vod/",
      isXml: false
    },
    {
      name: "如意",
      api: "https://cj.rycjapi.com/api.php/provide/vod/from/rym3u8/at/json/",
      isXml: false
    },
    {
      name: "天堂",
      api: "http://caiji.dyttzyapi.com/api.php/provide/vod/from/dyttm3u8/at/json/",
      isXml: false
    },
    {
      name: "天涯",
      api: "https://tyyszyapi.com/api.php/provide/vod/",
      isXml: false
    }
  ],
  
  // 测速配置
  speedTestConfig: {
    timeout: 10000,         // 请求超时时间（毫秒）
    retryCount: 3,          // 失败重试次数
    concurrentRequests: 4,  // 并发请求数
    testTypes: [
      {
        name: "搜索测试",
        enabled: true,
        keywords: ["柯南", "龙珠", "火影", "宝可梦"]
      },
      {
        name: "详情测试",
        enabled: true,
        // 详情测试会使用搜索结果的ID，如果搜索失败则跳过
      },
      {
        name: "流媒体测试",
        enabled: true,
        // 流媒体测试配置
        testMethod: "GET",  // 使用GET方法下载部分内容以测试实际速度
        maxStreamTestSize: 1024 * 1024 * 2,  // 下载最多2MB内容用于测速
        testResultCount: 5,  // 测试每个关键词搜索结果的前几个结果，默认为5个
        maxTimeout: 30000,   // 流媒体链接测试的超时时间（毫秒）
        downloadSpeedTest: true  // 启用下载速度测试，计算kb/s或mb/s
      }
    ],
    
    // 排序配置
    rankingConfig: {
      // 各项指标的权重（总和为1）
      weights: {
        searchTime: 0.10,    // 搜索响应时间权重
        detailTime: 0.05,    // 详情响应时间权重
        streamTime: 0.50,    // 流媒体响应时间权重（播放速度）
        successRate: 0.20,   // 成功率权重（增加此项很重要）
        resultCount: 0.15    // 搜索结果数量权重
      },
      
      // 是否优先考虑成功率（如果为true，则成功率低于阈值的接口将排在后面）
      prioritizeSuccessRate: false,
      successRateThreshold: 80  // 成功率阈值（百分比）
    }
  }
}; 
