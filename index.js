/**
 * 影视采集接口测速工具
 * 用于批量测试影视采集接口的响应速度和稳定性
 */

const fs = require('fs');
const path = require('path');
const fetch = require('node-fetch');
const { DOMParser } = require('xmldom');
const config = require('./config');

// 解析XML的辅助函数
function parseXML(xmlString) {
  const parser = new DOMParser({
    errorHandler: {
      warning: () => {},
      error: () => {},
      fatalError: () => {}
    }
  });
  
  const xmlDoc = parser.parseFromString(xmlString, "text/xml");
  
  // 递归将XML转为JavaScript对象
  function xmlToObj(node) {
    if (node.nodeType === 3) { // TEXT_NODE
      const value = node.nodeValue.trim();
      return value === "" ? null : value;
    }
    
    const obj = {};
    if (node.attributes) {
      for (let i = 0; i < node.attributes.length; i++) {
        const attr = node.attributes[i];
        obj[`@${attr.nodeName}`] = attr.nodeValue;
      }
    }
    
    for (let i = 0; i < node.childNodes.length; i++) {
      const child = node.childNodes[i];
      if (child.nodeType === 3) { // TEXT_NODE
        if (child.nodeValue.trim() !== '') {
          obj._text = child.nodeValue.trim();
        }
      } else if (child.nodeType === 4) { // CDATA_SECTION_NODE
        obj._text = child.nodeValue;
      } else {
        const childObj = xmlToObj(child);
        if (obj[child.nodeName]) {
          if (!Array.isArray(obj[child.nodeName])) {
            obj[child.nodeName] = [obj[child.nodeName]];
          }
          obj[child.nodeName].push(childObj);
        } else {
          obj[child.nodeName] = childObj;
        }
      }
    }
    
    return obj;
  }
  
  try {
    return xmlToObj(xmlDoc.documentElement);
  } catch (error) {
    console.error('XML解析错误:', error);
    return {};
  }
}

// 请求函数
async function makeRequest(url, isXml = false, timeout = 10000) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);
  
  try {
    const startTime = Date.now();
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Accept': isXml ? 'application/xml' : 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      },
      signal: controller.signal,
      // 添加忽略SSL证书验证的选项
      agent: function(_parsedURL) {
        if (_parsedURL.protocol === 'https:') {
          const https = require('https');
          return new https.Agent({
            rejectUnauthorized: false // 忽略SSL证书验证
          });
        }
        return null;
      }
    });
    
    if (!response.ok) {
      throw new Error(`HTTP错误: ${response.status}`);
    }
    
    const responseTime = Date.now() - startTime;
    
    if (isXml) {
      const xmlText = await response.text();
      return { data: parseXML(xmlText), responseTime };
    } else {
      const jsonData = await response.json();
      return { data: jsonData, responseTime };
    }
  } catch (error) {
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

// 测试搜索功能
async function testSearch(api, keyword, timeout) {
  const url = `${api.api}?ac=detail&wd=${encodeURIComponent(keyword)}`;
  
  try {
    const { data, responseTime } = await makeRequest(url, api.isXml, timeout);
    
    // 提取搜索结果数量
    let resultCount = 0;
    let firstResultId = null;
    let resultList = [];
    
    if (api.isXml) {
      // XML格式
      // console.log('      XML数据结构:', JSON.stringify(data));
      
      // 尝试多种可能的XML结构
      let items = [];
      
      // 结构1: <list><video id="123">...</video></list>
      if (data.list && data.list.video) {
        const videoData = data.list.video;
        items = Array.isArray(videoData) ? videoData : [videoData];
      }
      // 结构2: <rss><list><video id="123">...</video></list></rss>
      else if (data.rss && data.rss.list && data.rss.list.video) {
        const videoData = data.rss.list.video;
        items = Array.isArray(videoData) ? videoData : [videoData];
      }
      // 结构3: <videos><video id="123">...</video></videos>
      else if (data.videos && data.videos.video) {
        const videoData = data.videos.video;
        items = Array.isArray(videoData) ? videoData : [videoData];
      }
      // 结构4: <data><video id="123">...</video></data>
      else if (data.data && data.data.video) {
        const videoData = data.data.video;
        items = Array.isArray(videoData) ? videoData : [videoData];
      }
      
      resultCount = items.length;
      
      // 获取第一个结果的ID和标题
      if (resultCount > 0) {
        // 尝试多种可能的ID属性名
        const firstItem = items[0];
        firstResultId = firstItem['@id'] || firstItem['@vodid'] || firstItem['@vod_id'] || 
                       firstItem.id?._text || firstItem.vodid?._text || firstItem.vod_id?._text;
        
        // 尝试多种可能的标题属性名
        resultList = items.map(item => {
          const id = item['@id'] || item['@vodid'] || item['@vod_id'] || 
                    item.id?._text || item.vodid?._text || item.vod_id?._text;
          
          const title = item.name?._text || item.title?._text || item.vod_name?._text || 
                       item.vod_title?._text || '未知标题';
          
          return { id, title };
        });
      }
    } else {
      // JSON格式
      if (data.list && Array.isArray(data.list)) {
        resultCount = data.list.length;
        
        // 获取第一个结果的ID
        if (resultCount > 0) {
          firstResultId = data.list[0].vod_id;
          resultList = data.list.map(item => ({
            id: item.vod_id,
            title: item.vod_name || item.title || '未知标题'
          }));
        }
      }
    }
    
    return {
      success: true,
      responseTime,
      data,
      resultCount,
      firstResultId,
      resultList,
      error: null
    };
  } catch (error) {
    return {
      success: false,
      responseTime: null,
      data: null,
      resultCount: 0,
      firstResultId: null,
      resultList: [],
      error: error.message
    };
  }
}

// 测试详情功能
async function testDetail(api, id, timeout) {
  const url = `${api.api}?ac=detail&ids=${id}`;
  
  try {
    const { data, responseTime } = await makeRequest(url, api.isXml, timeout);
    return {
      success: true,
      responseTime,
      data,
      error: null
    };
  } catch (error) {
    return {
      success: false,
      responseTime: null,
      data: null,
      error: error.message
    };
  }
}

// 测试流媒体链接
async function testStreamUrl(url, method = 'HEAD', maxSize = 1024 * 1024, timeout = 10000, downloadSpeedTest = false) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);
  
  try {
    const startTime = Date.now();
    const response = await fetch(url, {
      method: method,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      },
      signal: controller.signal,
      // 添加忽略SSL证书验证的选项
      agent: function(_parsedURL) {
        if (_parsedURL.protocol === 'https:') {
          const https = require('https');
          return new https.Agent({
            rejectUnauthorized: false // 忽略SSL证书验证
          });
        }
        return null;
      }
    });
    
    const responseTime = Date.now() - startTime;
    let downloadSpeed = null;
    let downloadSize = 0;
    let contentType = response.headers.get('content-type') || '';
    let isM3u8 = url.toLowerCase().includes('.m3u8') || contentType.includes('mpegurl');
    let content = null;
    let realMediaUrl = null; // 记录真实的媒体文件URL
    
    // 如果使用GET方法，下载部分内容以测试实际流媒体速度
    if (method === 'GET' && response.ok && downloadSpeedTest) {
      try {
        const downloadStartTime = Date.now();
        
        // 获取响应内容
        content = await response.text();
        downloadSize = Buffer.byteLength(content);
        
        // 检查是否为m3u8文件，如果是，尝试获取真实的视频片段链接
        if (isM3u8 && content.includes('#EXTM3U')) {
          // console.log('      检测到M3U8文件，尝试解析...');
          
          // 递归解析M3U8文件，最多解析2层
          async function parseM3u8(m3u8Url, m3u8Content, depth = 0) {
            if (depth > 2) {
              console.log('      达到最大解析深度，停止解析');
              return null;
            }
            
            // 提取视频片段链接
            const lines = m3u8Content.split('\n');
            const segmentUrls = [];
            let isStreamInfoFound = false;
            
            for (let i = 0; i < lines.length; i++) {
              const line = lines[i].trim();
              
              // 检查是否包含流信息（可能是嵌套的m3u8）
              if (line.startsWith('#EXT-X-STREAM-INF:')) {
                isStreamInfoFound = true;
                continue;
              }
              
              // 不是注释行且可能是媒体文件链接
              if (!line.startsWith('#')) {
                if (line.length === 0) continue;
                
                let segmentUrl = line;
                
                // 如果是相对路径，构建完整URL
                if (!segmentUrl.startsWith('http')) {
                  const baseUrl = new URL(m3u8Url);
                  if (segmentUrl.startsWith('/')) {
                    // 绝对路径
                    segmentUrl = `${baseUrl.protocol}//${baseUrl.host}${segmentUrl}`;
                  } else {
                    // 相对路径
                    const urlPath = baseUrl.pathname.substring(0, baseUrl.pathname.lastIndexOf('/') + 1);
                    segmentUrl = `${baseUrl.protocol}//${baseUrl.host}${urlPath}${segmentUrl}`;
                  }
                }
                
                // 如果前一行是流信息，这可能是嵌套的m3u8文件
                if (isStreamInfoFound || segmentUrl.includes('.m3u8')) {
                  console.log(`      发现嵌套的M3U8文件: ${segmentUrl}`);
                  
                  try {
                    const nestedResponse = await fetch(segmentUrl, {
                      method: 'GET',
                      headers: {
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                      },
                      signal: controller.signal
                    });
                    
                    if (nestedResponse.ok) {
                      const nestedContent = await nestedResponse.text();
                      // 递归解析嵌套的m3u8
                      const nestedResult = await parseM3u8(segmentUrl, nestedContent, depth + 1);
                      if (nestedResult) return nestedResult;
                    }
                  } catch (err) {
                    console.error(`      嵌套M3U8解析失败: ${err.message}`);
                  }
                }
                
                // 如果是.ts文件或其他明显的媒体片段
                if (segmentUrl.includes('.ts') || 
                    segmentUrl.includes('.mp4') || 
                    segmentUrl.includes('.jpeg') || 
                    segmentUrl.includes('.jpg') || 
                    segmentUrl.includes('/hls/') || 
                    segmentUrl.includes('segment')) {
                  segmentUrls.push(segmentUrl);
                  if (segmentUrls.length >= 1) break; // 只获取第一个片段用于测试
                }
              }
            }
            
            return segmentUrls.length > 0 ? segmentUrls[0] : null;
          }
          
          // 开始解析M3U8
          realMediaUrl = await parseM3u8(url, content);
          
          // 如果找到真实媒体文件链接，测试其下载速度
          if (realMediaUrl) {
            console.log(`      找到真实媒体文件链接: ${realMediaUrl}`);
            try {
              const segmentStartTime = Date.now();
              const segmentResponse = await fetch(realMediaUrl, {
                method: 'GET',
                headers: {
                  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                },
                signal: controller.signal
              });
              
              if (segmentResponse.ok) {
                const segmentData = await segmentResponse.arrayBuffer();
                const segmentSize = segmentData.byteLength;
                const segmentTime = Date.now() - segmentStartTime;
                
                if (segmentTime > 0 && segmentSize > 0) {
                  downloadSpeed = Math.round((segmentSize / segmentTime) * 1000);
                  downloadSize = segmentSize;
                  console.log(`      媒体文件大小: ${downloadSize} 字节, 下载时间: ${segmentTime}ms`);
                }
              } else {
                console.error(`      媒体文件响应错误: ${segmentResponse.status}`);
              }
            } catch (segmentError) {
              console.error(`      媒体文件下载失败: ${segmentError.message}`);
            }
          } else {
            console.log(`      未找到可用的媒体文件链接，内容预览: ${content.substring(0, 400)}`);
          }
        } else {
          // 非m3u8文件，直接计算下载速度
          const downloadTime = Date.now() - downloadStartTime;
          if (downloadTime > 0 && downloadSize > 0) {
            downloadSpeed = Math.round((downloadSize / downloadTime) * 1000);
          }
        }
      } catch (err) {
        console.error('下载测速失败:', err);
      }
    }
    
    return {
      success: response.ok,
      responseTime,
      status: response.status,
      downloadSpeed,
      downloadSize,
      contentType,
      isM3u8,
      realMediaUrl,
      content: content ? content.substring(0, 200) + (content.length > 200 ? '...' : '') : null, // 保存前200个字符用于显示
      error: null
    };
  } catch (error) {
    return {
      success: false,
      responseTime: null,
      status: null,
      downloadSpeed: null,
      downloadSize: null,
      contentType: null,
      isM3u8: false,
      realMediaUrl: null,
      content: null,
      error: error.message
    };
  } finally {
    clearTimeout(timeoutId);
  }
}

// 测试多个流媒体链接并返回平均响应时间
async function testMultipleStreamUrls(urls, count, testConfig) {
  const { testMethod, maxStreamTestSize, maxTimeout, downloadSpeedTest } = testConfig;
  const urlsToTest = urls.slice(0, count); // 只测试前count个链接
  const results = [];
  
  // console.log(`    测试 ${urlsToTest.length} 个流媒体链接...`);
  
  for (let i = 0; i < urlsToTest.length; i++) {
    const url = urlsToTest[i];
    console.log(`\n--------------------------------`)
    console.log(`      测试链接 ${i + 1}/${urlsToTest.length}: ${url}`);
    
    const result = await testStreamUrl(url, testMethod, maxStreamTestSize, maxTimeout, downloadSpeedTest);
    results.push({
      url,
      ...result
    });
    
    if (result.success) {
      let speedInfo = '';
      if (result.downloadSpeed) {
        speedInfo = `, 下载速度: ${formatSpeed(result.downloadSpeed)}`;
      } else {
        speedInfo = ', 无法测量下载速度';
      }
      console.log(`      响应时间: ${result.responseTime}ms${speedInfo}`);
      
      // if (result.isM3u8) {
      //   console.log(`      内容类型: M3U8 播放列表`);
      //   if (result.realMediaUrl) {
      //     console.log(`      真实媒体文件: ${result.realMediaUrl}`);
      //   }
      // } else if (result.contentType) {
      //   console.log(`      内容类型: ${result.contentType}`);
      // }
      
      // if (result.content) {
      //   console.log(`      内容预览: ${result.content}`);
      // }
    } else {
      console.log(`      测试失败: ${result.error}`);
    }
  }
  
  // 计算成功的测试的平均响应时间和下载速度
  const successResults = results.filter(r => r.success);
  const avgResponseTime = successResults.length > 0
    ? Math.round(successResults.reduce((sum, r) => sum + r.responseTime, 0) / successResults.length)
    : null;
  
  // 计算平均下载速度 (只考虑有下载速度的结果)
  const resultsWithSpeed = successResults.filter(r => r.downloadSpeed && r.downloadSpeed > 0);
  const avgDownloadSpeed = resultsWithSpeed.length > 0
    ? Math.round(resultsWithSpeed.reduce((sum, r) => sum + r.downloadSpeed, 0) / resultsWithSpeed.length)
    : null;
  
  return {
    results,
    successCount: successResults.length,
    totalCount: results.length,
    avgResponseTime,
    avgDownloadSpeed,
    speedTestCount: resultsWithSpeed.length
  };
}

// 从详情数据中提取流媒体链接
function extractStreamUrls(data, isXml) {
  if (isXml) {
    // XML格式
    try {
      // console.log('      提取XML流媒体链接，数据结构:', JSON.stringify(data));
      
      // 尝试多种可能的XML结构
      let movie = null;
      let playSourceFlag = null;
      
      // 从URL中提取播放源标识
      const baseUrl = data['@baseurl'] || '';
      if (baseUrl) {
        const fromRegex = /\/from\/([^\/]+)/i;
        const fromMatch = baseUrl.match(fromRegex);
        if (fromMatch && fromMatch[1]) {
          playSourceFlag = fromMatch[1];
          console.log(`      检测到播放源标识: ${playSourceFlag}`);
        }
      }
      
      // 结构1: <list><video>...</video></list>
      if (data.list && data.list.video) {
        movie = Array.isArray(data.list.video) ? data.list.video[0] : data.list.video;
      }
      // 结构2: <rss><list><video>...</video></list></rss>
      else if (data.rss && data.rss.list && data.rss.list.video) {
        movie = Array.isArray(data.rss.list.video) ? data.rss.list.video[0] : data.rss.list.video;
      }
      // 结构3: <video>...</video>
      else if (data.video) {
        movie = data.video;
      }
      // 结构4: <data><video>...</video></data>
      else if (data.data && data.data.video) {
        movie = Array.isArray(data.data.video) ? data.data.video[0] : data.data.video;
      }
      
      if (!movie) {
        console.log('      未找到视频数据节点');
        return [];
      }
      
      // console.log('      找到视频数据节点:', JSON.stringify(movie).substring(0, 200) + '...');
      
      // 尝试不同的XML结构提取流媒体链接
      let urls = [];
      
      // 结构1: <dl><dd flag="m3u8">url</dd></dl>
      if (movie.dl && movie.dl.dd) {
        const dds = Array.isArray(movie.dl.dd) ? movie.dl.dd : [movie.dl.dd];
        
        // 如果有播放源标识，优先匹配对应的播放源
        if (playSourceFlag) {
          const matchedDds = dds.filter(dd => dd['@flag'] === playSourceFlag);
          if (matchedDds.length > 0) {
            for (const dd of matchedDds) {
              // 检查是否是集数$URL#集数$URL格式
              if (dd._text && dd._text.includes('$')) {
                // console.log(`      检测到集数$URL格式，解析链接`);
                
                // 处理包含#分隔的多集链接
                if (dd._text.includes('#')) {
                  const parts = dd._text.split('#');
                  const extractedUrls = parts.map(part => {
                    const splitPart = part.split('$');
                    // 确保至少有两部分，且第二部分是URL
                    if (splitPart.length >= 2) {
                      return splitPart[splitPart.length - 1]; // 取最后一部分作为URL
                    }
                    return null;
                  }).filter(Boolean);
                  
                  if (extractedUrls.length > 0) {
                    // console.log(`      从<dl><dd flag="${playSourceFlag}">结构提取到 ${extractedUrls.length} 个链接`);
                    urls = [...urls, ...extractedUrls];
                  }
                } else {
                  // 处理单集链接，格式如"全集完结$https://play.subokk.com/play/ZdPPpwnd/index.m3u8"
                  const splitPart = dd._text.split('$');
                  if (splitPart.length >= 2) {
                    const url = splitPart[splitPart.length - 1];
                    urls.push(url);
                    // console.log(`      从<dl><dd flag="${playSourceFlag}">结构提取到单集链接: ${url}`);
                  }
                }
              } else if (dd._text) {
                // 单个链接
                urls.push(dd._text);
                console.log(`      从<dl><dd flag="${playSourceFlag}">结构提取到 1 个链接: ${dd._text}`);
              }
            }
          }
        }
        
        // 如果没有找到匹配的播放源或没有指定播放源，提取所有支持的播放源
        if (urls.length === 0) {
          const supportedFlags = ['m3u8', 'http', 'hls', 'mp4', 'lzm3u8', 'subm3u8', 'wjm3u8'];
          
          for (const dd of dds) {
            const flag = dd['@flag'];
            if (supportedFlags.includes(flag) && dd._text) {
              // 检查是否是集数$URL#集数$URL格式
              if (dd._text.includes('$')) {
                // console.log(`      检测到集数$URL格式，flag=${flag}，解析链接`);
                
                // 处理包含#分隔的多集链接
                if (dd._text.includes('#')) {
                  const parts = dd._text.split('#');
                  const extractedUrls = parts.map(part => {
                    const splitPart = part.split('$');
                    // 确保至少有两部分，且第二部分是URL
                    if (splitPart.length >= 2) {
                      return splitPart[splitPart.length - 1]; // 取最后一部分作为URL
                    }
                    return null;
                  }).filter(Boolean);
                  
                  if (extractedUrls.length > 0) {
                    // console.log(`      从<dl><dd flag="${flag}">结构提取到 ${extractedUrls.length} 个链接`);
                    urls = [...urls, ...extractedUrls];
                  }
                } else {
                  // 处理单集链接，格式如"全集完结$https://play.subokk.com/play/ZdPPpwnd/index.m3u8"
                  const splitPart = dd._text.split('$');
                  if (splitPart.length >= 2) {
                    const url = splitPart[splitPart.length - 1];
                    urls.push(url);
                    // console.log(`      从<dl><dd flag="${flag}">结构提取到单集链接: ${url}`);
                  }
                }
              } else {
                // 单个链接
                urls.push(dd._text);
                // console.log(`      从<dl><dd flag="${flag}">结构提取到 1 个链接: ${dd._text}`);
              }
            }
          }
        }
      }
      
      // 结构2: <url>url</url> 或 <url_m3u8>url</url_m3u8>
      if (urls.length === 0) {
        if (movie.url && movie.url._text) {
          console.log('      从<url>结构提取链接');
          urls.push(movie.url._text);
        }
        if (movie.url_m3u8 && movie.url_m3u8._text) {
          console.log('      从<url_m3u8>结构提取链接');
          urls.push(movie.url_m3u8._text);
        }
      }
      
      // 结构3: <playurl>url</playurl>
      if (urls.length === 0 && movie.playurl && movie.playurl._text) {
        console.log('      从<playurl>结构提取链接');
        urls.push(movie.playurl._text);
      }
      
      // 结构4: <vod_play_url>name$url#name$url</vod_play_url>
      if (urls.length === 0 && movie.vod_play_url && movie.vod_play_url._text) {
        console.log('      从<vod_play_url>结构提取链接');
        const playUrl = movie.vod_play_url._text;
        const parts = playUrl.split('#');
        const extractedUrls = parts.map(part => {
          const [, url] = part.split('$');
          return url;
        }).filter(Boolean);
        
        if (extractedUrls.length > 0) {
          urls = [...urls, ...extractedUrls];
        }
      }
      
      // 结构5: <player><src>url</src></player>
      if (urls.length === 0 && movie.player && movie.player.src && movie.player.src._text) {
        console.log('      从<player><src>结构提取链接');
        urls.push(movie.player.src._text);
      }
      
      // 过滤无效链接
      urls = urls.filter(url => url && url.trim() && (url.startsWith('http') || url.startsWith('//')));
      
      // 修复链接格式
      urls = urls.map(url => {
        if (url.startsWith('//')) {
          return 'https:' + url;
        }
        return url;
      });
      
      // console.log(`      共提取到 ${urls.length} 个流媒体链接`);
      // if (urls.length > 0) {
      //   console.log(`      前3个链接: ${urls.slice(0, 3).join(', ')}`);
      // } else {
      //   console.log('      未找到可用的流媒体链接');
      // }
      
      return urls;
    } catch (e) {
      console.error('提取XML流媒体链接失败:', e);
      return [];
    }
  } else {
    // JSON格式
    try {
      // 尝试不同的JSON结构
      let urls = [];
      
      // 结构1: data.list[0].vod_play_url
      if (data.list && data.list.length > 0) {
        const playUrl = data.list[0].vod_play_url;
        if (playUrl) {
          // 通常格式为 "name$url#name$url"
          const parts = playUrl.split('#');
          urls = parts.map(part => {
            const [, url] = part.split('$');
            return url;
          }).filter(Boolean);
        }
      }
      
      // 结构2: data.urls
      if (urls.length === 0 && data.urls && Array.isArray(data.urls)) {
        urls = data.urls.map(item => item.url).filter(Boolean);
      }
      
      return urls;
    } catch (e) {
      console.error('提取JSON流媒体链接失败:', e);
      return [];
    }
  }
}

// 根据100分制评分标准计算得分的辅助函数
function getSearchTimeScore(time) {
  if (!time) return 0;
  if (time <= 500) return 100;
  if (time <= 1000) return 90;
  if (time <= 1500) return 80;
  if (time <= 2000) return 70; 
  if (time <= 3000) return 50;
  if (time <= 5000) return 30;
  if (time > 5000) return 10;
  return 0;
}

function getDetailTimeScore(time) {
  if (!time) return 0;
  if (time <= 300) return 100;
  if (time <= 600) return 90;
  if (time <= 1000) return 70;
  if (time <= 1500) return 50;
  if (time <= 2000) return 30;
  if (time <= 3000) return 20;
  if (time > 3000) return 10;
  return 0;
}

function getStreamTimeScore(time) {
  if (!time) return 0;
  if (time <= 300) return 100;
  if (time <= 600) return 90;
  if (time <= 1000) return 80;
  if (time <= 1500) return 70;
  if (time <= 2000) return 60;
  if (time <= 3000) return 40;
  if (time <= 5000) return 20;
  if (time > 5000) return 10;
  return 0;
}

function getDownloadSpeedScore(speed) {
  if (!speed) return 0;
  if (speed >= 10 * 1024) return 100; // ≥10MB/s
  if (speed >= 5 * 1024) return 90;  // ≥5MB/s
  if (speed >= 2 * 1024) return 80;  // ≥2MB/s
  if (speed >= 1024) return 70;      // ≥1MB/s
  if (speed >= 500) return 60;       // ≥500KB/s
  if (speed >= 200) return 50;       // ≥200KB/s
  if (speed >= 100) return 40;       // ≥100KB/s
  if (speed >= 50) return 20;        // ≥50KB/s
  return 10;                         // <50KB/s
}

function getSuccessRateScore(rate) {
  if (rate === 100) return 100;
  if (rate >= 80) return 90;
  if (rate >= 60) return 70;
  if (rate >= 40) return 50;
  if (rate >= 20) return 30;
  if (rate > 0) return 10;
  return 0;
}

function getResultCountScore(count) {
  if (!count) return 0;
  if (count >= 30) return 100;
  if (count >= 20) return 90;
  if (count >= 15) return 80;
  if (count >= 10) return 70;
  if (count >= 5) return 50;
  if (count >= 2) return 30;
  if (count >= 1) return 10;
  return 0;
}

// 计算综合得分并排序
function calculateScores(results) {
  const scoreData = [];
  const { rankingConfig } = config.speedTestConfig;
  const weights = rankingConfig.weights;
  
  for (const apiName in results) {
    const apiResult = results[apiName];
    let searchTimes = [];
    let searchSuccess = 0;
    let searchTotal = 0;
    let totalResultCount = 0;
    
    // 计算搜索结果
    for (const keyword in apiResult.search) {
      searchTotal++;
      const result = apiResult.search[keyword];
      if (result.success) {
        searchSuccess++;
        searchTimes.push(result.responseTime);
        totalResultCount += result.resultCount || 0;
      }
    }
    
    const avgSearchTime = searchTimes.length > 0 
      ? Math.round(searchTimes.reduce((a, b) => a + b, 0) / searchTimes.length) 
      : null;
    
    // 计算详情结果
    let detailTimes = [];
    let detailSuccess = 0;
    let detailTotal = 0;
    
    for (const keyword in apiResult.detail) {
      detailTotal++;
      const result = apiResult.detail[keyword];
      if (result && result.success) {
        detailSuccess++;
        detailTimes.push(result.responseTime);
      }
    }
    
    const avgDetailTime = detailTimes.length > 0
      ? Math.round(detailTimes.reduce((a, b) => a + b, 0) / detailTimes.length)
      : null;
    
    // 计算流媒体结果
    let streamTimes = [];
    let streamDownloadSpeeds = [];
    let streamSuccess = 0;
    let streamTotal = 0;
    
    for (const keyword in apiResult.stream) {
      streamTotal++;
      const result = apiResult.stream[keyword];
      if (result && result.avgResponseTime) {
        streamSuccess++;
        streamTimes.push(result.avgResponseTime);
        
        if (result.avgDownloadSpeed) {
          streamDownloadSpeeds.push(result.avgDownloadSpeed);
        }
      }
    }
    
    const avgStreamTime = streamTimes.length > 0
      ? Math.round(streamTimes.reduce((a, b) => a + b, 0) / streamTimes.length)
      : null;
    
    const avgDownloadSpeed = streamDownloadSpeeds.length > 0
      ? Math.round(streamDownloadSpeeds.reduce((a, b) => a + b, 0) / streamDownloadSpeeds.length)
      : null;
    
    // 计算成功率
    const searchSuccessRate = searchTotal > 0 ? (searchSuccess / searchTotal) * 100 : 0;
    const detailSuccessRate = detailTotal > 0 ? (detailSuccess / detailTotal) * 100 : 0;
    const streamSuccessRate = streamTotal > 0 ? (streamSuccess / streamTotal) * 100 : 0;
    
    // 计算综合成功率（加权平均）
    const successRate = Math.round(
      (searchSuccessRate * 0.3) + (detailSuccessRate * 0.3) + (streamSuccessRate * 0.4)
    );
    
    // 使用100分制评分计算各项得分
    const searchTimeScore = getSearchTimeScore(avgSearchTime);
    const detailTimeScore = getDetailTimeScore(avgDetailTime);
    const streamTimeScore = getStreamTimeScore(avgStreamTime);
    const downloadSpeedScore = getDownloadSpeedScore(avgDownloadSpeed);
    const searchSuccessScore = getSuccessRateScore(searchSuccessRate);
    const detailSuccessScore = getSuccessRateScore(detailSuccessRate);
    const streamSuccessScore = getSuccessRateScore(streamSuccessRate);
    const resultCountScore = getResultCountScore(totalResultCount);
    
    // 分解权重
    const searchSuccessWeight = weights.successRate * 0.3;
    const detailSuccessWeight = weights.successRate * 0.3;
    const streamSuccessWeight = weights.successRate * 0.4;
    
    // 流媒体时间权重包括响应时间和下载速度
    const streamResponseWeight = weights.streamTime * 0.3;
    const downloadSpeedWeight = weights.streamTime * 0.7;
    
    // 计算加权总分（100分制）
    let score100 = 0;
    if (avgSearchTime) { // 确保至少有搜索结果
      score100 = 
        (searchTimeScore * weights.searchTime) +
        (detailTimeScore * weights.detailTime) +
        (streamTimeScore * streamResponseWeight) +
        (downloadSpeedScore * downloadSpeedWeight) +
        (searchSuccessScore * searchSuccessWeight) +
        (detailSuccessScore * detailSuccessWeight) +
        (streamSuccessScore * streamSuccessWeight) +
        (resultCountScore * weights.resultCount);
      
      // 四舍五入到整数
      score100 = Math.round(score100);
      
      // 特殊情况处理
      if (searchSuccessScore === 0) {
        score100 = Math.min(score100, 40);
      }
      
      if (detailSuccessScore === 0) {
        score100 = Math.min(score100, 60);
      }
      
      if (streamSuccessScore === 0) {
        score100 = Math.min(score100, 30);
      }
    }
    
    // 计算兼容旧版的排序分数（越低越好，保留为历史参考）
    let score = 10000; // 默认很高的分数
    
    if (avgSearchTime) {
      score = avgSearchTime * weights.searchTime;
      
      if (avgDetailTime) {
        score += avgDetailTime * weights.detailTime;
      } else {
        score += 1000 * weights.detailTime;
      }
      
      if (avgStreamTime) {
        if (avgDownloadSpeed && weights.streamTime > 0) {
          const downloadSpeedScore = 1000000 / avgDownloadSpeed;
          score += downloadSpeedScore * weights.streamTime;
        } else {
          score += avgStreamTime * weights.streamTime;
        }
      } else {
        score += 2000 * weights.streamTime;
      }
      
      if (weights.successRate > 0) {
        score += (100 - successRate) * weights.successRate;
      }
      
      if (weights.resultCount > 0 && totalResultCount > 0) {
        const resultCountScore = 1000 / Math.log10(totalResultCount + 10);
        score += resultCountScore * weights.resultCount;
      }
    }
    
    scoreData.push({
      name: apiName,
      api: apiResult.api,
      isXml: apiResult.isXml,
      avgSearchTime,
      avgDetailTime,
      avgStreamTime,
      avgDownloadSpeed,
      searchSuccessRate: Math.round(searchSuccessRate),
      detailSuccessRate: Math.round(detailSuccessRate),
      streamSuccessRate: Math.round(streamSuccessRate),
      successRate,
      totalResultCount,
      score,
      score100
    });
  }
  
  // 返回按100分制评分排序的结果（分数越高越好）
  return scoreData.sort((a, b) => b.score100 - a.score100);
}

// 生成测试报告
function generateReport(results, sortedResults) {
  const reportTime = new Date().toISOString().replace(/[:.]/g, '-');
  const reportDir = path.join(__dirname, 'reports');
  
  if (!fs.existsSync(reportDir)) {
    fs.mkdirSync(reportDir);
  }
  
  const reportPath = path.join(reportDir, `speed-test-report-${reportTime}.json`);
  const htmlReportPath = path.join(reportDir, `speed-test-report-${reportTime}.html`);
  
  // 保存JSON报告
  fs.writeFileSync(reportPath, JSON.stringify({
    results,
    sortedResults
  }, null, 2));
  
  // 生成HTML报告
  let htmlContent = `
  <!DOCTYPE html>
  <html lang="zh-CN">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>影视采集接口测速报告</title>
    <link rel="icon" href="https://tv.vayfou.cn/favicon.ico" type="image/x-icon">
    <style>
      body {
        font-family: 'PingFang SC', 'Microsoft YaHei', sans-serif;
        line-height: 1.6;
        color: #333;
        max-width: 1200px;
        margin: 0 auto;
        padding: 20px;
        background-color: #f5f5f5;
      }
      .header {
        text-align: center;
        margin-bottom: 30px;
        padding: 20px;
        background: linear-gradient(135deg, #6e8efb, #a777e3);
        color: white;
        border-radius: 8px;
        box-shadow: 0 4px 6px rgba(0,0,0,0.1);
      }
      .api-card {
        background-color: white;
        border-radius: 8px;
        padding: 20px;
        margin-bottom: 20px;
        box-shadow: 0 2px 4px rgba(0,0,0,0.05);
      }
      .api-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        border-bottom: 1px solid #eee;
        padding-bottom: 10px;
        margin-bottom: 15px;
      }
      .api-name {
        font-size: 1.4em;
        font-weight: bold;
        color: #333;
      }
      .api-score {
        font-size: 0.7em;
        margin-left: 12px;
        padding: 4px 8px;
        border-radius: 4px;
        vertical-align: middle;
      }
      .api-url {
        color: #666;
        font-size: 0.9em;
        word-break: break-all;
      }
      .test-section {
        margin-top: 20px;
      }
      .test-title {
        font-size: 1.2em;
        font-weight: bold;
        margin-bottom: 10px;
        color: #444;
      }
      table {
        width: 100%;
        border-collapse: collapse;
      }
      th, td {
        padding: 12px;
        text-align: left;
        border-bottom: 1px solid #eee;
      }
      th {
        background-color: #f9f9f9;
        font-weight: 600;
      }
      .success {
        color: #28a745;
      }
      .error {
        color: #dc3545;
      }
      .response-time {
        font-weight: bold;
      }
      .summary {
        margin-top: 30px;
        background-color: white;
        border-radius: 8px;
        padding: 20px;
        box-shadow: 0 2px 4px rgba(0,0,0,0.05);
      }
      .summary-title {
        font-size: 1.3em;
        font-weight: bold;
        margin-bottom: 15px;
        color: #333;
      }
      .summary-table {
        width: 100%;
      }
      .footer {
        margin-top: 40px;
        text-align: center;
        font-size: 0.9em;
        color: #666;
      }
      .rank {
        font-weight: bold;
        font-size: 1.1em;
      }
      .rank-1 {
        color: #FFD700;
      }
      .rank-2 {
        color: #C0C0C0;
      }
      .rank-3 {
        color: #CD7F32;
      }
      .result-count {
        background-color: #f0f0f0;
        border-radius: 12px;
        padding: 2px 8px;
        font-size: 0.85em;
        color: #555;
        margin-left: 5px;
      }
      .score {
        font-weight: bold;
        font-size: 1.1em;
        text-align: center;
      }
      .score-excellent {
        color: #1e9e54;
        background-color: #e6f7ed;
      }
      .score-good {
        color: #2b78d4;
        background-color: #e6f1fa;
      }
      .score-average {
        color: #f5a623;
        background-color: #fef7e8;
      }
      .score-poor {
        color: #d93026;
        background-color: #fdedeb;
      }
      .score-details {
        margin-top: 15px;
        border-top: 1px dashed #eee;
        padding-top: 15px;
      }
      .score-details-title {
        font-weight: bold;
        margin-bottom: 10px;
        color: #444;
      }
      .score-grid {
        display: grid;
        grid-template-columns: repeat(4, 1fr);
        gap: 10px;
      }
      .score-item {
        background-color: #f9f9f9;
        border-radius: 6px;
        padding: 10px;
      }
      .score-item-title {
        font-size: 0.9em;
        color: #666;
        margin-bottom: 5px;
      }
      .score-item-value {
        font-weight: bold;
        color: #333;
      }
      .weights-info {
        margin-top: 20px;
        font-size: 0.9em;
        background-color: #f8f9fa;
        padding: 10px;
        border-radius: 6px;
      }
      .weights-title {
        font-weight: bold;
        margin-bottom: 5px;
      }
      .weights-grid {
        display: grid;
        grid-template-columns: repeat(5, 1fr);
        gap: 10px;
      }
      .weight-item {
        text-align: center;
      }
      .scoring-explanation {
        margin-top: 40px;
        padding: 20px;
        background-color: white;
        border-radius: 8px;
        box-shadow: 0 2px 4px rgba(0,0,0,0.05);
      }
      .scoring-explanation-title {
        font-size: 1.3em;
        font-weight: bold;
        margin-bottom: 15px;
        color: #333;
      }
      .scoring-table {
        width: 100%;
        margin-top: 15px;
      }
      .scoring-table th {
        background-color: #f5f5f5;
      }
      .scoring-subtitle {
        font-weight: bold;
        margin-top: 15px;
        margin-bottom: 10px;
        color: #444;
      }
      .footnote {
        font-style: italic;
        color: #666;
        margin-top: 10px;
      }
    </style>
  </head>
  <body>
    <div class="header">
      <h1>影视采集接口测速报告</h1>
      <p>生成时间: ${new Date().toLocaleString()}</p>
    </div>
    
    <div class="summary">
      <div class="summary-title">测试摘要 (按综合速度排序)</div>
      <table class="summary-table">
        <tr>
          <th>排名</th>
          <th>接口名称</th>
          <th>综合评分</th>
          <th>搜索响应时间</th>
          <th>详情响应时间</th>
          <th>流媒体响应时间</th>
          <th>下载速度</th>
          <th>搜索成功率</th>
          <th>详情成功率</th>
          <th>流媒体成功率</th>
          <th>搜索结果数</th>
        </tr>
  `;
  
  // 添加排序后的摘要数据
  sortedResults.forEach((result, index) => {
    const rankClass = index < 3 ? `rank-${index + 1}` : '';
    
    // 根据得分确定颜色
    let scoreColorClass = '';
    if (result.score100 >= 90) {
      scoreColorClass = 'score-excellent';
    } else if (result.score100 >= 75) {
      scoreColorClass = 'score-good';
    } else if (result.score100 >= 60) {
      scoreColorClass = 'score-average';
    } else {
      scoreColorClass = 'score-poor';
    }
    
    htmlContent += `
      <tr>
        <td class="rank ${rankClass}">${index + 1}</td>
        <td>${result.name}</td>
        <td class="score ${scoreColorClass}">${result.score100}/100</td>
        <td>${result.avgSearchTime ? result.avgSearchTime + 'ms' : 'N/A'}</td>
        <td>${result.avgDetailTime ? result.avgDetailTime + 'ms' : 'N/A'}</td>
        <td>${result.avgStreamTime ? result.avgStreamTime + 'ms' : 'N/A'}</td>
        <td>${result.avgDownloadSpeed ? formatSpeed(result.avgDownloadSpeed) : 'N/A'}</td>
        <td>${result.searchSuccessRate}%</td>
        <td>${result.detailSuccessRate}%</td>
        <td>${result.streamSuccessRate}%</td>
        <td>${result.totalResultCount}</td>
      </tr>
    `;
  });
  
  htmlContent += `
      </table>
    </div>
  `;
  
  // 添加详细结果（按排名顺序）
  sortedResults.forEach((sortedResult, index) => {
    const apiName = sortedResult.name;
    const apiResult = results[apiName];
    const rankClass = index < 3 ? `rank-${index + 1}` : '';
    
    // 根据得分确定颜色
    let scoreColorClass = '';
    if (sortedResult.score100 >= 90) {
      scoreColorClass = 'score-excellent';
    } else if (sortedResult.score100 >= 75) {
      scoreColorClass = 'score-good';
    } else if (sortedResult.score100 >= 60) {
      scoreColorClass = 'score-average';
    } else {
      scoreColorClass = 'score-poor';
    }
    
    htmlContent += `
    <div class="api-card">
      <div class="api-header">
        <div class="api-name">
          <span class="rank ${rankClass}">#${index + 1}</span> ${apiName}
          <span class="api-score ${scoreColorClass}">${sortedResult.score100}/100分</span>
        </div>
        <div class="api-url">${apiResult.api} (${apiResult.isXml ? 'XML' : 'JSON'})</div>
      </div>
      
      <div class="score-details">
        <div class="score-details-title">评分详情</div>
        <div class="score-grid">
          <div class="score-item">
            <div class="score-item-title">搜索响应时间</div>
            <div class="score-item-value">${getSearchTimeScore(sortedResult.avgSearchTime)}/100 (权重得分: ${Math.round(getSearchTimeScore(sortedResult.avgSearchTime) * config.speedTestConfig.rankingConfig.weights.searchTime)})</div>
          </div>
          <div class="score-item">
            <div class="score-item-title">详情响应时间</div>
            <div class="score-item-value">${getDetailTimeScore(sortedResult.avgDetailTime)}/100 (权重得分: ${Math.round(getDetailTimeScore(sortedResult.avgDetailTime) * config.speedTestConfig.rankingConfig.weights.detailTime)})</div>
          </div>
          <div class="score-item">
            <div class="score-item-title">流媒体响应时间</div>
            <div class="score-item-value">${getStreamTimeScore(sortedResult.avgStreamTime)}/100 (权重得分: ${Math.round(getStreamTimeScore(sortedResult.avgStreamTime) * config.speedTestConfig.rankingConfig.weights.streamTime * 0.3)})</div>
          </div>
          <div class="score-item">
            <div class="score-item-title">下载速度</div>
            <div class="score-item-value">${getDownloadSpeedScore(sortedResult.avgDownloadSpeed)}/100 (权重得分: ${Math.round(getDownloadSpeedScore(sortedResult.avgDownloadSpeed) * config.speedTestConfig.rankingConfig.weights.streamTime * 0.7)})</div>
          </div>
          <div class="score-item">
            <div class="score-item-title">搜索成功率</div>
            <div class="score-item-value">${getSuccessRateScore(sortedResult.searchSuccessRate)}/100 (权重得分: ${Math.round(getSuccessRateScore(sortedResult.searchSuccessRate) * config.speedTestConfig.rankingConfig.weights.successRate * 0.3)})</div>
          </div>
          <div class="score-item">
            <div class="score-item-title">详情成功率</div>
            <div class="score-item-value">${getSuccessRateScore(sortedResult.detailSuccessRate)}/100 (权重得分: ${Math.round(getSuccessRateScore(sortedResult.detailSuccessRate) * config.speedTestConfig.rankingConfig.weights.successRate * 0.3)})</div>
          </div>
          <div class="score-item">
            <div class="score-item-title">流媒体成功率</div>
            <div class="score-item-value">${getSuccessRateScore(sortedResult.streamSuccessRate)}/100 (权重得分: ${Math.round(getSuccessRateScore(sortedResult.streamSuccessRate) * config.speedTestConfig.rankingConfig.weights.successRate * 0.4)})</div>
          </div>
          <div class="score-item">
            <div class="score-item-title">搜索结果数量</div>
            <div class="score-item-value">${getResultCountScore(sortedResult.totalResultCount)}/100 (权重得分: ${Math.round(getResultCountScore(sortedResult.totalResultCount) * config.speedTestConfig.rankingConfig.weights.resultCount)})</div>
          </div>
        </div>
        
        <div class="weights-info">
          <div class="weights-title">当前权重配置</div>
          <div class="weights-grid">
            <div class="weight-item">搜索响应时间: ${config.speedTestConfig.rankingConfig.weights.searchTime * 100}%</div>
            <div class="weight-item">详情响应时间: ${config.speedTestConfig.rankingConfig.weights.detailTime * 100}%</div>
            <div class="weight-item">流媒体性能: ${config.speedTestConfig.rankingConfig.weights.streamTime * 100}%</div>
            <div class="weight-item">成功率: ${config.speedTestConfig.rankingConfig.weights.successRate * 100}%</div>
            <div class="weight-item">结果数量: ${config.speedTestConfig.rankingConfig.weights.resultCount * 100}%</div>
          </div>
        </div>
      </div>
      
      <div class="test-section">
        <div class="test-title">搜索测试</div>
        <table>
          <tr>
            <th>关键词</th>
            <th>状态</th>
            <th>响应时间</th>
            <th>结果数量</th>
            <th>错误信息</th>
          </tr>
    `;
    
    for (const keyword in apiResult.search) {
      const result = apiResult.search[keyword];
      htmlContent += `
        <tr>
          <td>${keyword}</td>
          <td class="${result.success ? 'success' : 'error'}">${result.success ? '成功' : '失败'}</td>
          <td class="response-time">${result.responseTime ? result.responseTime + 'ms' : 'N/A'}</td>
          <td>${result.resultCount || 0} <span class="result-count">条</span></td>
          <td class="error">${result.error || ''}</td>
        </tr>
      `;
    }
    
    htmlContent += `
        </table>
      </div>
    `;
    
    // 详情测试结果
    if (Object.keys(apiResult.detail).length > 0) {
      htmlContent += `
      <div class="test-section">
        <div class="test-title">详情测试</div>
        <table>
          <tr>
            <th>关键词</th>
            <th>状态</th>
            <th>响应时间</th>
            <th>错误信息</th>
          </tr>
    `;
      
      for (const keyword in apiResult.detail) {
        const detailResult = apiResult.detail[keyword];
        htmlContent += `
          <tr>
            <td>${keyword}</td>
            <td class="${detailResult.success ? 'success' : 'error'}">${detailResult.success ? '成功' : '失败'}</td>
            <td class="response-time">${detailResult.responseTime ? detailResult.responseTime + 'ms' : 'N/A'}</td>
            <td class="error">${detailResult.error || ''}</td>
          </tr>
        `;
      }
      
      htmlContent += `
        </table>
      </div>
      `;
    }
    
    // 流媒体测试结果
    if (Object.keys(apiResult.stream).length > 0) {
      htmlContent += `
      <div class="test-section">
        <div class="test-title">流媒体链接测试</div>
        <table>
          <tr>
            <th>关键词</th>
            <th>成功率</th>
            <th>平均响应时间</th>
            <th>平均下载速度</th>
          </tr>
    `;
      
      for (const keyword in apiResult.stream) {
        const streamResult = apiResult.stream[keyword];
        htmlContent += `
          <tr>
            <td>${keyword}</td>
            <td>${streamResult.successCount || 0}/${streamResult.totalCount || 0}</td>
            <td class="response-time">${streamResult.avgResponseTime ? streamResult.avgResponseTime + 'ms' : 'N/A'}</td>
            <td>${streamResult.avgDownloadSpeed ? formatSpeed(streamResult.avgDownloadSpeed) : 'N/A'}</td>
          </tr>
        `;
      }
      
      htmlContent += `
        </table>
      </div>
      `;
    }

    htmlContent += `
    </div>
    `;
  });
  
  htmlContent += `
    <div class="scoring-explanation">
      <div class="scoring-explanation-title">评分标准说明</div>
      <p>本测试报告使用100分制评分系统，结合用户配置的权重动态计算各个API的综合得分。评分越高，表示API整体性能越好。</p>
      
      <div class="scoring-subtitle">搜索响应时间评分标准</div>
      <table class="scoring-table">
        <tr>
          <th>响应时间</th>
          <th>得分（满分100）</th>
        </tr>
        <tr><td>≤500ms</td><td>100分</td></tr>
        <tr><td>501-1000ms</td><td>90分</td></tr>
        <tr><td>1001-1500ms</td><td>80分</td></tr>
        <tr><td>1501-2000ms</td><td>70分</td></tr>
        <tr><td>2001-3000ms</td><td>50分</td></tr>
        <tr><td>3001-5000ms</td><td>30分</td></tr>
        <tr><td>>5000ms</td><td>10分</td></tr>
        <tr><td>超时或失败</td><td>0分</td></tr>
      </table>
      
      <div class="scoring-subtitle">详情响应时间评分标准</div>
      <table class="scoring-table">
        <tr>
          <th>响应时间</th>
          <th>得分（满分100）</th>
        </tr>
        <tr><td>≤300ms</td><td>100分</td></tr>
        <tr><td>301-600ms</td><td>90分</td></tr>
        <tr><td>601-1000ms</td><td>70分</td></tr>
        <tr><td>1001-1500ms</td><td>50分</td></tr>
        <tr><td>1501-2000ms</td><td>30分</td></tr>
        <tr><td>2001-3000ms</td><td>20分</td></tr>
        <tr><td>>3000ms</td><td>10分</td></tr>
        <tr><td>超时或失败</td><td>0分</td></tr>
      </table>
      
      <div class="scoring-subtitle">流媒体响应时间评分标准</div>
      <table class="scoring-table">
        <tr>
          <th>响应时间</th>
          <th>得分（满分100）</th>
        </tr>
        <tr><td>≤300ms</td><td>100分</td></tr>
        <tr><td>301-600ms</td><td>90分</td></tr>
        <tr><td>601-1000ms</td><td>80分</td></tr>
        <tr><td>1001-1500ms</td><td>70分</td></tr>
        <tr><td>1501-2000ms</td><td>60分</td></tr>
        <tr><td>2001-3000ms</td><td>40分</td></tr>
        <tr><td>3001-5000ms</td><td>20分</td></tr>
        <tr><td>>5000ms</td><td>10分</td></tr>
        <tr><td>超时或失败</td><td>0分</td></tr>
      </table>
      
      <div class="scoring-subtitle">下载速度评分标准</div>
      <table class="scoring-table">
        <tr>
          <th>下载速度</th>
          <th>得分（满分100）</th>
        </tr>
        <tr><td>≥10MB/s</td><td>100分</td></tr>
        <tr><td>5-10MB/s</td><td>90分</td></tr>
        <tr><td>2-5MB/s</td><td>80分</td></tr>
        <tr><td>1-2MB/s</td><td>70分</td></tr>
        <tr><td>500KB/s-1MB/s</td><td>60分</td></tr>
        <tr><td>200-500KB/s</td><td>50分</td></tr>
        <tr><td>100-200KB/s</td><td>40分</td></tr>
        <tr><td>50-100KB/s</td><td>20分</td></tr>
        <tr><td><50KB/s</td><td>10分</td></tr>
        <tr><td>无法测量</td><td>0分</td></tr>
      </table>
      
      <div class="scoring-subtitle">成功率评分标准</div>
      <table class="scoring-table">
        <tr>
          <th>成功率</th>
          <th>得分（满分100）</th>
        </tr>
        <tr><td>100%</td><td>100分</td></tr>
        <tr><td>80-99%</td><td>90分</td></tr>
        <tr><td>60-79%</td><td>70分</td></tr>
        <tr><td>40-59%</td><td>50分</td></tr>
        <tr><td>20-39%</td><td>30分</td></tr>
        <tr><td>1-19%</td><td>10分</td></tr>
        <tr><td>0%</td><td>0分</td></tr>
      </table>
      
      <div class="scoring-subtitle">搜索结果数量评分标准</div>
      <table class="scoring-table">
        <tr>
          <th>结果数量</th>
          <th>得分（满分100）</th>
        </tr>
        <tr><td>≥30个</td><td>100分</td></tr>
        <tr><td>20-29个</td><td>90分</td></tr>
        <tr><td>15-19个</td><td>80分</td></tr>
        <tr><td>10-14个</td><td>70分</td></tr>
        <tr><td>5-9个</td><td>50分</td></tr>
        <tr><td>2-4个</td><td>30分</td></tr>
        <tr><td>1个</td><td>10分</td></tr>
        <tr><td>0个</td><td>0分</td></tr>
      </table>
      
      <div class="scoring-subtitle">综合得分计算方法</div>
      <p>1. 分别计算各项指标的基础得分（满分100分）</p>
      <p>2. 根据权重计算各项指标的加权得分</p>
      <p>3. 汇总所有加权得分，得到最终的100分制评分</p>
      
      <div class="footnote">注：部分项目（如成功率和流媒体性能）进一步拆分为多个子项目，按一定比例计算。本评分系统会随用户配置的权重动态调整。</div>
    </div>
    
    <div class="footer">
      <p>影视采集接口测速工具 v1.0 | 100分制动态权重评分系统 v2.0</p>
      <p>评分系统规则：搜索响应时间、详情响应时间、流媒体响应时间、下载速度、搜索/详情/流媒体成功率、搜索结果数量</p>
    </div>
  </body>
  </html>
`;
  
  // 保存HTML报告
  fs.writeFileSync(htmlReportPath, htmlContent);
  
  console.log(`\n测试完成！`);
  console.log(`JSON报告已保存至: ${reportPath}`);
  console.log(`HTML报告已保存至: ${htmlReportPath}`);
}

// 格式化速度显示
function formatSpeed(bytesPerSecond) {
  if (bytesPerSecond >= 1024 * 1024) {
    // 大于等于1MB/s
    return `${(bytesPerSecond / (1024 * 1024)).toFixed(2)}MB/s`;
  } else if (bytesPerSecond >= 1024) {
    // 大于等于1KB/s
    return `${(bytesPerSecond / 1024).toFixed(2)}KB/s`;
  } else {
    // 小于1KB/s
    return `${bytesPerSecond.toFixed(2)}B/s`;
  }
}

// 运行测试
async function runTest() {
  const { apiList, speedTestConfig } = config;
  const results = {};
  
  console.log('开始测试采集接口速度...');
  console.log(`共有 ${apiList.length} 个接口需要测试`);
  
  let index = 1;
  for (const api of apiList) {
    console.log(`\n\n#################### ${index}: ${api.name}###############################`)
    console.log(`\n测试接口: ${api.name} (${api.api})`);
    results[api.name] = {
      api: api.api,
      isXml: api.isXml,
      search: {},
      detail: {},
      stream: {}
    };
    
    // 测试搜索
    if (speedTestConfig.testTypes.find(t => t.name === "搜索测试" && t.enabled)) {
      console.log('  测试搜索功能...');
      const keywords = speedTestConfig.testTypes.find(t => t.name === "搜索测试").keywords;
      
      for (const keyword of keywords) {
        console.log(`\n\n==============================================\n`);
        console.log(`    关键词: ${keyword}`);
        let bestResult = null;
        
        // 重试机制
        for (let i = 0; i < speedTestConfig.retryCount; i++) {
          const result = await testSearch(api, keyword, speedTestConfig.timeout);
          
          if (result.success) {
            if (!bestResult || result.responseTime < bestResult.responseTime) {
              bestResult = result;
            }
            break; // 成功就跳出重试循环
          } else if (i < speedTestConfig.retryCount - 1) {
            console.log(`    尝试 ${i + 1} 失败，重试...`);
          }
        }
        
        results[api.name].search[keyword] = bestResult || { 
          success: false, 
          responseTime: null,
          resultCount: 0,
          resultList: [],
          error: '所有尝试均失败' 
        };
        
        if (bestResult && bestResult.success) {
          console.log(`    响应时间: ${bestResult.responseTime}ms, 结果数量: ${bestResult.resultCount}`);
          
          // 如果搜索成功且有结果，测试第一个结果的详情
          if (bestResult.resultList && bestResult.resultList.length > 0) {
            const firstResult = bestResult.resultList[0];
            console.log(`    测试第一个结果详情: ${firstResult.title} (ID: ${firstResult.id})`);
            
            // 测试详情
            if (speedTestConfig.testTypes.find(t => t.name === "详情测试" && t.enabled)) {
              let bestDetailResult = null;
              
              // 重试机制
              for (let i = 0; i < speedTestConfig.retryCount; i++) {
                const detailResult = await testDetail(api, firstResult.id, speedTestConfig.timeout);
                
                if (detailResult.success) {
                  if (!bestDetailResult || detailResult.responseTime < bestDetailResult.responseTime) {
                    bestDetailResult = detailResult;
                  }
                  break; // 成功就跳出重试循环
                } else if (i < speedTestConfig.retryCount - 1) {
                  console.log(`    详情尝试 ${i + 1} 失败，重试...`);
                }
              }
              
              results[api.name].detail[keyword] = bestDetailResult || { 
                success: false, 
                responseTime: null, 
                error: '所有详情尝试均失败' 
              };
              
              if (bestDetailResult && bestDetailResult.success) {
                console.log(`    详情响应时间: ${bestDetailResult.responseTime}ms`);
                
                // 测试流媒体链接
                const streamUrls = extractStreamUrls(bestDetailResult.data, api.isXml);
                
                if (streamUrls.length > 0) {
                  const streamTestConfig = speedTestConfig.testTypes.find(t => t.name === "流媒体测试");
                  const testCount = streamTestConfig.testResultCount || 5; // 默认测试5个链接
                  
                  console.log(`    找到 ${streamUrls.length} 个流媒体链接，测试前 ${Math.min(testCount, streamUrls.length)} 个链接...`);
                  
                  const multiStreamResult = await testMultipleStreamUrls(
                    streamUrls,
                    testCount,
                    streamTestConfig
                  );
                  
                  results[api.name].stream[keyword] = {
                    multipleResults: multiStreamResult.results,
                    successCount: multiStreamResult.successCount,
                    totalCount: multiStreamResult.totalCount,
                    avgResponseTime: multiStreamResult.avgResponseTime,
                    avgDownloadSpeed: multiStreamResult.avgDownloadSpeed
                  };
                  
                  if (multiStreamResult.successCount > 0) {
                    let speedInfo = '';
                    if (multiStreamResult.avgDownloadSpeed) {
                      speedInfo = `, 平均下载速度: ${formatSpeed(multiStreamResult.avgDownloadSpeed)}`;
                      if (multiStreamResult.speedTestCount) {
                        speedInfo += ` (${multiStreamResult.speedTestCount}/${multiStreamResult.successCount} 个链接成功测速)`;
                      }
                    } else {
                      speedInfo = ', 无法测量下载速度';
                    }
                    console.log(`\n    流媒体链接平均响应时间: ${multiStreamResult.avgResponseTime}ms (${multiStreamResult.successCount}/${multiStreamResult.totalCount} 成功)${speedInfo}`);
                  } else {
                    console.log(`\n    所有流媒体链接测试失败`);
                  }
                } else {
                  console.log('    未找到可用的流媒体链接');
                  results[api.name].stream[keyword] = {
                    success: false,
                    error: '未找到可用的流媒体链接'
                  };
                }
              } else {
                console.log('    详情测试失败');
              }
            }
          } else {
            console.log('    未找到搜索结果，无法测试详情和流媒体');
          }
        } else {
          console.log('    搜索测试失败');
        }
      }
    }

    index++;
  }
  
  // 计算综合得分并排序
  const sortedResults = calculateScores(results);
  
  // 生成报告
  generateReport(results, sortedResults);
}

// 运行测试
runTest();
