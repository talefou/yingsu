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
      name: "电影天堂",
      api: "http://caiji.dyttzyapi.com/api.php/provide/vod",
      isXml: false
    },
    {
      name: "如意资源",
      api: "http://cj.rycjapi.com/api.php/provide/vod",
      isXml: false
    },
    {
      name: "暴风资源",
      api: "https://bfzyapi.com/api.php/provide/vod",
      isXml: false
    },
    {
      name: "天涯资源",
      api: "https://tyyszy.com/api.php/provide/vod",
      isXml: false
    },
    {
      name: "非凡影视",
      api: "http://ffzy5.tv/api.php/provide/vod",
      isXml: false
    },
    {
      name: "360资源",
      api: "https://360zy.com/api.php/provide/vod",
      isXml: false
    },
    {
      name: "茅台资源",
      api: "https://caiji.maotaizy.cc/api.php/provide/vod",
      isXml: false
    },
    {
      name: "卧龙资源",
      api: "https://wolongzyw.com/api.php/provide/vod",
      isXml: false
    },
    {
      name: "极速资源",
      api: "https://jszyapi.com/api.php/provide/vod",
      isXml: false
    },
    {
      name: "豆瓣资源",
      api: "https://dbzy.tv/api.php/provide/vod",
      isXml: false
    },
    {
      name: "魔爪资源",
      api: "https://mozhuazy.com/api.php/provide/vod",
      isXml: false
    },
    {
      name: "魔都资源",
      api: "https://www.mdzyapi.com/api.php/provide/vod",
      isXml: false
    },
    {
      name: "最大资源",
      api: "https://api.zuidapi.com/api.php/provide/vod",
      isXml: false
    },
    {
      name: "樱花资源",
      api: "https://m3u8.apiyhzy.com/api.php/provide/vod",
      isXml: false
    },
    {
      name: "无尽资源",
      api: "https://api.wujinapi.me/api.php/provide/vod",
      isXml: false
    },
    {
      name: "旺旺短剧",
      api: "https://wwzy.tv/api.php/provide/vod",
      isXml: false
    },
    {
      name: "iKun资源",
      api: "https://ikunzyapi.com/api.php/provide/vod",
      isXml: false
    },
    {
      name: "量子资源",
      api: "https://cj.lziapi.com/api.php/provide/vod",
      isXml: false
    },
    {
      name: "百度资源",
      api: "https://api.apibdzy.com/api.php/provide/vod",
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
