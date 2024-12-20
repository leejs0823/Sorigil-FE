let currentVoice = null;
let currentLang = 'ko-KR';
let currentRate = 1;
let currentPitch = 1;
let currentVolume = 1;

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.text) {
    const utterance = message.text;

    // 음성 설정 업데이트
    const options = {
      voiceName: currentVoice, // 음성
      lang: currentLang, // 언어
      rate: Number(currentRate), // 속도
      pitch: Number(currentPitch), // 음조
      volume: Number(currentVolume), // 볼륨
    };

    chrome.tts.speak(utterance, options);
  }
});

// 음성 언어 및 설정 변경
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'setVoice') {
    currentVoice = message.voice;
  } else if (message.type === 'setLanguage') {
    currentLang = message.language === '한국어' ? 'ko-KR' : 'en-US';
  } else if (message.type === 'setRate') {
    currentRate = message.rate;
  } else if (message.type === 'setPitch') {
    currentPitch = message.pitch;
  } else if (message.type === 'setVolume') {
    currentVolume = message.volume;
  }
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.text) {
    // 받은 메시지의 text를 읽어서 처리할 수 있습니다.
    console.log('받은 텍스트:', message.text);

    // 예: 텍스트를 알림으로 출력
    new SpeechSynthesisUtterance(message.text); // TTS로 읽기

    // 응답을 보내는 경우
    sendResponse({ status: 'success' });
  }
  return true; // 비동기 응답을 사용하려면 true를 반환
});

chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.set({ ETRI_API_KEY: '172d57d8-892e-4450-80e6-2e00e019ffbb' });
});

// eslint-disable-next-line
function sendMessageToContentScript(tabId, message) {
  return new Promise((resolve, reject) => {
    chrome.tabs.sendMessage(tabId, message, (response) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
      } else {
        resolve(response);
      }
    });
  });
}

// 단축키를 눌렀을 때 녹음 시작
chrome.commands.onCommand.addListener(async (command) => {
  if (command === 'custom-shortcut-1') {
    console.log('단축키 활성화, 음성 명령 시작');
    try {
      // 활성 탭 찾기
      chrome.tabs.query({ active: true }, (tabs) => {
        if (tabs.length > 0) {
          const tabId = tabs[0].id;
          chrome.scripting.executeScript(
            { target: { tabId }, files: ['content.js'] }, // content script 주입
            () => {
              chrome.tabs.sendMessage(tabId, { action: 'custom-shortcut-1' }, (response) => {
                if (chrome.runtime.lastError) {
                  console.error('메시지 전달 오류:', chrome.runtime.lastError.message);
                } else {
                  console.log('content.js 응답:', response);
                }
              });
            }
          );
        } else {
          console.error('활성 탭을 찾을 수 없습니다.');
        }
      });

      console.log('활성 탭 찾기', tabs[0].i);
      if (tabs.length > 0) {
        const tabId = tabs[0].id;
        const response = await sendMessageToContentScript(tabId, { action: 'start-voice-command' });
        console.log('content.js 응답:', response);
      } else {
        console.error('활성 탭을 찾을 수 없습니다.');
      }
    } catch (error) {
      console.error('메시지 전달 오류:', error.message);
    }
  }
});

// 탭에서 실행될 소리 조정 스크립트
const adjustVolumeScript = (volume) => `
  const videos = document.querySelectorAll("video, audio");
  videos.forEach((media) => {
    media.volume = ${volume};
    console.log("볼륨 설정:", media.volume);
  });
`;

chrome.commands.onCommand.addListener(async (command) => {
  // eslint-disable-next-line
  console.log('단축키 호출:', command);

  try {
    // 현재 활성 탭 가져오기
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });

    if (tabs.length === 0) {
      console.error('활성 탭을 찾을 수 없습니다.');
      return;
    }

    const tabId = tabs[0].id;

    if (command === 'custom-shortcut-2') {
      currentVolume = Math.min(1, currentVolume + 0.1);
      await chrome.scripting.executeScript({
        target: { tabId },
        func: (volume) => {
          const videos = document.querySelectorAll('video, audio');
          videos.forEach((media) => {
            media.volume = volume;
            console.log('볼륨 설정:', media.volume);
          });
        },
        args: [currentVolume],
      });
      console.log('소리를 키웁니다. 현재 볼륨:', currentVolume);
    } else if (command === 'custom-shortcut-3') {
      currentVolume = Math.max(0, currentVolume - 0.1);
      await chrome.scripting.executeScript({
        target: { tabId },
        func: (volume) => {
          const videos = document.querySelectorAll('video, audio');
          videos.forEach((media) => {
            media.volume = volume;
            console.log('볼륨 설정:', media.volume);
          });
        },
        args: [currentVolume],
      });
      console.log('소리를 줄입니다. 현재 볼륨:', currentVolume);
    }
  } catch (error) {
    console.error('오류 발생:', error.message);
  }
});

chrome.runtime.onMessage.addListener(async (message, sender, sendResponse) => {
  if (message.action === 'update-shortcuts') {
    const { shortcuts } = message;

    // 저장된 단축키를 업데이트
    chrome.storage.local.set({ shortcuts }, () => {
      console.log('단축키가 저장되었습니다.');
      sendResponse({ status: 'success' });
    });
    return true; // 비동기 응답을 위해 true 반환
  }
});
let storedShortcuts = [];

// 저장된 단축키를 로드
const loadShortcuts = () => {
  chrome.storage.local.get('shortcuts', (result) => {
    storedShortcuts = result.shortcuts || [];
    console.log('저장된 단축키:', storedShortcuts);
  });
};

// 초기화 시 단축키 로드
chrome.runtime.onInstalled.addListener(() => loadShortcuts());
chrome.runtime.onStartup.addListener(() => loadShortcuts());

// 단축키 동작 처리 함수
const handleShortcutAction = (shortcutId) => {
  const shortcut = storedShortcuts.find((s) => s.id === shortcutId);
  if (shortcut) {
    switch (shortcut.description) {
      case '커서 크기':
        console.log('커서 크기 조절 실행');
        break;
      case 'Start voice recognition':
        console.log('음성 인식 시작 실행');
        break;
      case 'Volume up':
        console.log('소리를 키웁니다.');
        break;
      case 'Volume down':
        console.log('소리를 줄입니다.');
        break;
      default:
        console.log('알 수 없는 동작');
    }
  } else {
    console.log('등록된 동작이 없습니다:', shortcutId);
  }
};

// 메시지 기반 단축키 처리
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'key-pressed') {
    const { pressedKey } = message;
    console.log('감지된 키:', pressedKey);

    const shortcut = storedShortcuts.find((s) => s.shortcut === pressedKey);
    if (shortcut) {
      console.log(`단축키 동작 실행: ${shortcut.description}`);
      handleShortcutAction(shortcut.id);
    } else {
      console.log('저장된 단축키가 없음');
    }
  }
});
