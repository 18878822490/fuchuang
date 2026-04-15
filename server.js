const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const axios = require('axios');
require('dotenv').config();

const app = express();
const API_KEY = process.env.QWEN_API_KEY || 'sk-f6440fac0e9c43a48a727122a8625c57';
const API_URL = process.env.QWEN_API_URL || 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions';
const DATA_FILE = path.join(__dirname, 'data.json');

async function qwenChat(messages) {
  if (!API_KEY) {
    throw new Error('Missing QWEN_API_KEY');
  }
  const response = await axios.post(API_URL, {
    model: 'qwen-turbo',
    messages
  }, {
    headers: {
      Authorization: `Bearer ${API_KEY}`,
      'Content-Type': 'application/json'
    }
  });
  return response.data.choices?.[0]?.message?.content?.trim();
}

app.use(cors());
app.use(express.json());
app.use(express.static(__dirname, { extensions: ['html'] }));

function loadData() {
  try {
    return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  } catch (error) {
    const initial = {
      settings: {
        vol: 80,
        speed: 85,
        simpleMode: false,
        fontSize: 18,
        voiceEnabled: true,
        contrastMode: false,
        nightMode: false
      },
      avatarConfig: {
        preset: 0,
        outfit: 'qipao',
        bg: 'garden',
        voice: 'warm'
      },
      profile: {
        name: '李奶奶',
        phone: '13888888888',
        vip: true,
        activeDays: 127,
        familyCount: 2
      },
      report: {
        metrics: { mood: 82, sleep: 7.5, energy: 68 },
        daily: { labels: ['6时', '9时', '12时', '15时', '18时', '21时'], values: [65, 72, 78, 82, 75, 80] },
        weekly: { labels: ['周一', '周二', '周三', '周四', '周五', '周六', '周日'], values: [70, 75, 68, 82, 79, 85, 80] }
      },
      memories: [],
      reminders: [],
      avatarOutfits: [
        { id: 'qipao', label: '传统旗袍', description: '优雅温婉，适合陪伴风格' },
        { id: 'modern', label: '现代简约', description: '时尚清新，安心舒适' },
        { id: 'sport', label: '运动休闲', description: '活力满满，动感轻松' },
        { id: 'tang', label: '唐装汉服', description: '古典优雅，亲切温柔' },
        { id: 'formal', label: '正式商务', description: '稳重专业，信赖感强' }
      ],
      codes: {},
      sessions: {}
    };
    fs.writeFileSync(DATA_FILE, JSON.stringify(initial, null, 2), 'utf8');
    return initial;
  }
}

function saveData(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf8');
}

const data = loadData();
const remindersTimers = new Map();

function scheduleReminder(reminder) {
  const due = new Date(reminder.time).getTime();
  const remaining = due - Date.now();
  if (remaining <= 0) {
    return;
  }
  if (remindersTimers.has(reminder.id)) {
    clearTimeout(remindersTimers.get(reminder.id));
  }
  const timeout = setTimeout(() => {
    console.log(`提醒触发：${reminder.text} (${reminder.time})`);
    remindersTimers.delete(reminder.id);
  }, Math.min(remaining, 2147483647));
  remindersTimers.set(reminder.id, timeout);
}

function initReminders() {
  data.reminders.forEach(scheduleReminder);
}

initReminders();

app.post('/api/send-code', (req, res) => {
  const phone = (req.body.phone || '').toString();
  if (!/^1[3-9]\d{9}$/.test(phone)) {
    return res.status(400).json({ ok: false, message: '请输入正确的手机号码' });
  }
  const code = '123456';
  data.codes[phone] = code;
  saveData(data);
  res.json({ ok: true, message: '验证码已发送', code });
});

app.post('/api/login', (req, res) => {
  const phone = (req.body.phone || '').toString();
  const code = (req.body.code || '').toString();
  const expected = data.codes[phone] || '123456';
  if (code !== expected) {
    return res.status(400).json({ ok: false, message: '验证码错误，请重新输入' });
  }
  data.sessions[phone] = { phone, lastLogin: Date.now() };
  saveData(data);
  res.json({ ok: true, profile: data.profile, message: '登录成功' });
});

app.get('/api/profile', (req, res) => {
  res.json({ ok: true, profile: data.profile });
});

app.get('/api/settings', (req, res) => {
  res.json({ ok: true, settings: data.settings });
});

app.post('/api/settings', (req, res) => {
  data.settings = Object.assign({}, data.settings, req.body);
  saveData(data);
  res.json({ ok: true, settings: data.settings });
});

app.get('/api/avatar-config', (req, res) => {
  res.json({ ok: true, avatarConfig: data.avatarConfig });
});

app.post('/api/avatar-config', (req, res) => {
  data.avatarConfig = Object.assign({}, data.avatarConfig, req.body);
  saveData(data);
  res.json({ ok: true, avatarConfig: data.avatarConfig });
});

app.get('/api/report', (req, res) => {
  res.json({ ok: true, report: data.report });
});

app.get('/api/report-summary', async (req, res) => {
  const defaultSummary = '今天的报告显示心情良好，睡眠保持稳定，建议继续保持适度运动与规律作息。';
  if (!API_KEY) {
    return res.json({ ok: true, summary: defaultSummary });
  }
  try {
    const summary = await qwenChat([
      { role: 'system', content: '你是一个老年人健康助手，提供温暖、鼓励性的心理与生活建议。' },
      { role: 'user', content: `请根据以下报告数据给出简洁的关怀建议：${JSON.stringify(data.report)}` }
    ]);
    res.json({ ok: true, summary: summary || defaultSummary });
  } catch (error) {
    console.warn('QWEN 报告摘要失败：', error?.message || error);
    res.json({ ok: true, summary: defaultSummary });
  }
});

app.get('/api/profile-advice', async (req, res) => {
  const defaultAdvice = '您好，晴晴建议您多喝水、适当散步，并与家人多保持联系。';
  if (!API_KEY) {
    return res.json({ ok: true, advice: defaultAdvice });
  }
  try {
    const advice = await qwenChat([
      { role: 'system', content: '你是一个贴心的家庭助理，给长者提供温馨建议。' },
      { role: 'user', content: `根据用户档案：${JSON.stringify(data.profile)}，请给出一个简短的生活建议。` }
    ]);
    res.json({ ok: true, advice: advice || defaultAdvice });
  } catch (error) {
    console.warn('QWEN 个人建议失败：', error?.message || error);
    res.json({ ok: true, advice: defaultAdvice });
  }
});

app.get('/api/avatar-outfits', (req, res) => {
  res.json({ ok: true, outfits: data.avatarOutfits });
});

app.get('/api/avatar-suggestions', async (req, res) => {
  const defaultSuggestion = '晴晴建议您选择温柔舒适的旗袍或现代简约套装，让陪伴更贴心、安心。';
  if (!API_KEY) {
    return res.json({ ok: true, suggestion: defaultSuggestion });
  }
  try {
    const suggestion = await qwenChat([
      { role: 'system', content: '你是一个时尚而贴心的虚拟形象顾问，帮助老年用户选择舒适优雅的服饰。' },
      { role: 'user', content: '请给出一条适合老年人数字人陪伴页面的服装推荐建议。' }
    ]);
    res.json({ ok: true, suggestion: suggestion || defaultSuggestion });
  } catch (error) {
    console.warn('QWEN 形象建议失败：', error?.message || error);
    res.json({ ok: true, suggestion: defaultSuggestion });
  }
});

app.get('/api/memories', (req, res) => {
  res.json({ ok: true, memories: data.memories });
});

app.post('/api/memories', (req, res) => {
  const text = ((req.body.text || '').toString()).trim();
  const time = req.body.time ? new Date(req.body.time).toISOString() : null;
  if (!text) {
    return res.status(400).json({ ok: false, message: '记录内容不能为空' });
  }
  const memory = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    text,
    time,
    createdAt: new Date().toISOString()
  };
  data.memories.unshift(memory);
  if (time) {
    const reminder = { ...memory, type: '提醒' };
    data.reminders.push(reminder);
    scheduleReminder(reminder);
  }
  saveData(data);
  res.json({ ok: true, memory, reminders: data.reminders });
});

app.get('/api/reminders', (req, res) => {
  res.json({ ok: true, reminders: data.reminders });
});

app.post('/api/reminders', (req, res) => {
  const text = ((req.body.text || '').toString()).trim();
  const time = req.body.time ? new Date(req.body.time).toISOString() : null;
  if (!text || !time) {
    return res.status(400).json({ ok: false, message: '提醒内容和时间不能为空' });
  }
  const reminder = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    text,
    time,
    createdAt: new Date().toISOString()
  };
  data.reminders.push(reminder);
  saveData(data);
  scheduleReminder(reminder);
  res.json({ ok: true, reminder });
});

app.post('/api/chat', async (req, res) => {
  const message = ((req.body.message || '').toString()).trim();
  const phone = (req.body.phone || '').toString();

  if (!message) {
    return res.status(400).json({ ok: false, message: '消息不能为空' });
  }

  const factKeywords = /(吃药|服药|就医|预约|聚会|见|参加|提醒|日程|生活习惯|待办)/i;
  const timeKeyword = /(\d{1,2}点|\d{1,2}月\d{1,2}日|\d{1,2}号|上午|下午|晚上|明天|后天)/i;
  if (factKeywords.test(message) || timeKeyword.test(message)) {
    const memory = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      text: message,
      createdAt: new Date().toISOString()
    };
    data.memories.unshift(memory);
    saveData(data);
  }

  let reply = null;

  if (API_KEY) {
    try {
      reply = await qwenChat([
        {
          role: 'system',
          content: '你是一个亲切、温柔、贴心的虚拟数字人“晴晴”，专门为老年用户提供陪伴、日常建议和情绪支持。回答要简洁、尊重、鼓励，并避免使用过于专业的术语。'
        },
        {
          role: 'user',
          content: `用户手机号：${phone || '未知'}，用户问题：${message}`
        }
      ]);
    } catch (error) {
      console.warn('QWEN 调用失败：', error?.message || error);
      reply = null;
    }
  }

  if (!reply) {
    const lowerMessage = message.toLowerCase();
    const rules = [
      { match: ['家人', '妈妈', '爸爸', '宝贝'], reply: '我帮您记住了，等一下可以提醒您给家人打电话。' },
      { match: ['吃什么', '午餐', '晚餐', '早餐'], reply: '建议您今天午餐吃清淡一点，搭配一份汤和软糯米饭。' },
      { match: ['健康操', '运动', '锻炼'], reply: '我们可以一起做5分钟健康操，先从抬手、扭腰开始。' },
      { match: ['歌曲', '音乐', '唱歌'], reply: '我给您放一首轻柔的疗愈音乐，让您放松心情。' },
      { match: ['天气', '气温', '雨'], reply: '今天气温适中，建议您适量外出散步，记得带上帽子和水。' },
      { match: ['心情', '烦', '难过', '高兴'], reply: '我在这儿陪着您，遇到心情不好时可以跟我说说。' }
    ];

    reply = '好的，我已经听到您的需求了。';
    for (const rule of rules) {
      if (rule.match.some(key => lowerMessage.includes(key))) {
        reply = rule.reply;
        break;
      }
    }

    if (lowerMessage.match(/^(hi|hello|你好|您好)/)) {
      reply = '您好！我是晴晴，随时陪您聊聊天。';
    }
  }

  res.json({ ok: true, reply });
});

app.get('*', (req, res, next) => {
  if (req.method === 'GET' && !path.extname(req.path)) {
    res.sendFile(path.join(__dirname, 'page1_login.html'));
  } else {
    next();
  }
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`颐心服务器已启动：http://localhost:${port}`);
});
