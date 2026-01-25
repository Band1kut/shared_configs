// ============================================
// Bitrix24 Auto Cleaner - Основной скрипт
// Загружается в основной документ Bitrix24
// ============================================

console.log('🚀 Bitrix24 Auto Cleaner загружен');

class IframeDetector {
    constructor() {
        this.containerSelector = '.side-panel-content-wrapper';
        this.iframeSelectors = [
            '.side-panel-iframe',
            'iframe[src*="/crm/deal/details/"]',
            'iframe[src*="IFRAME=Y"]'
        ];
        
        this.retryCounts = {
            container: 5,
            iframe: 10,
            load: 5
        };
        
        this.retryDelays = {
            container: [500, 1000, 2000, 3000, 5000],
            iframe: [500, 500, 1000, 1000, 2000, 2000, 3000, 5000, 8000, 13000],
            load: [500, 1000, 2000, 3000, 5000]
        };
        
        this.currentIframe = null;
        this.detectionStartTime = null;
    }
    
    async findIframe() {
        console.log('🎯 [IframeDetector] Начинаем поиск целевого iframe...');
        this.detectionStartTime = Date.now();
        
        try {
            // Этап 1: Поиск контейнера
            const container = await this.findContainer();
            if (!container) {
                console.error('❌ [IframeDetector] Контейнер не найден');
                return null;
            }
            
            // Этап 2: Поиск iframe в контейнере
            const iframe = await this.findIframeInContainer(container);
            if (!iframe) {
                console.error('❌ [IframeDetector] Iframe не найден в контейнере');
                return null;
            }
            
            // Этап 3: Валидация iframe
            const isValid = await this.validateIframe(iframe);
            if (!isValid) {
                console.error('❌ [IframeDetector] Iframe не прошел валидацию');
                return null;
            }
            
            // Этап 4: Ожидание загрузки
            const isLoaded = await this.waitForIframeLoad(iframe);
            if (!isLoaded) {
                console.error('❌ [IframeDetector] Iframe не загрузился');
                return null;
            }
            
            const totalTime = Date.now() - this.detectionStartTime;
            console.log(`✅ [IframeDetector] Поиск успешно завершен за ${totalTime}мс`);
            console.log(`📍 [IframeDetector] Iframe найден:`, {
                id: iframe.id,
                src: iframe.src.substring(0, 100) + '...'
            });
            
            return iframe;
            
        } catch (error) {
            console.error('💥 [IframeDetector] Критическая ошибка поиска:', error);
            return null;
        }
    }
    
    async findContainer() {
        console.log(`=== ЭТАП 1: ПОИСК КОНТЕЙНЕРА ===`);
        console.log(`🎯 Ищем: ${this.containerSelector}`);
        
        for (let attempt = 0; attempt < this.retryCounts.container; attempt++) {
            const delay = this.retryDelays.container[attempt] || 1000;
            
            if (attempt > 0) {
                console.log(`🔄 Попытка ${attempt + 1}/${this.retryCounts.container} (через ${delay}мс)...`);
                await this.sleep(delay);
            }
            
            const containers = document.querySelectorAll(this.containerSelector);
            console.log(`📊 Результат: найдено ${containers.length} контейнеров`);
            
            if (containers.length > 0) {
                const container = containers[0];
                console.log(`✅ Успех! Контейнер найден на попытке ${attempt + 1}`);
                console.log(`📍 Контейнер:`, {
                    id: container.id,
                    className: container.className,
                    children: container.children.length
                });
                return container;
            }
        }
        
        console.error(`❌ Контейнер не появился после ${this.retryCounts.container} попыток`);
        return null;
    }
    
    async findIframeInContainer(container) {
        console.log(`=== ЭТАП 2: ПОИСК IFRAME В КОНТЕЙНЕРЕ ===`);
        
        for (let attempt = 0; attempt < this.retryCounts.iframe; attempt++) {
            const delay = this.retryDelays.iframe[attempt] || 1000;
            
            if (attempt > 0) {
                console.log(`🔄 Попытка ${attempt + 1}/${this.retryCounts.iframe} (через ${delay}мс)...`);
                await this.sleep(delay);
            }
            
            // Пробуем все селекторы по очереди
            for (const selector of this.iframeSelectors) {
                const fullSelector = `${this.containerSelector} ${selector}`;
                const iframes = container.querySelectorAll(selector);
                
                console.log(`🔍 Проверяем селектор: "${selector}"`);
                console.log(`📊 Найдено iframe: ${iframes.length}`);
                
                if (iframes.length > 0) {
                    const iframe = iframes[0];
                    console.log(`✅ Найден iframe на попытке ${attempt + 1} (селектор: "${selector}")`);
                    console.log(`📍 Iframe:`, {
                        id: iframe.id,
                        src: iframe.src.substring(0, 100) + '...',
                        className: iframe.className
                    });
                    return iframe;
                }
            }
            
            if (attempt < this.retryCounts.iframe - 1) {
                console.log(`⚠️ Iframe еще не появился в контейнере...`);
            }
        }
        
        console.error(`❌ Iframe не появился в контейнере после ${this.retryCounts.iframe} попыток`);
        return null;
    }
    
    async validateIframe(iframe) {
        console.log(`=== ЭТАП 3: ВАЛИДАЦИЯ IFRAME ===`);
        
        // Проверка 1: Src должен содержать путь к CRM сделке
        const hasValidPath = iframe.src && iframe.src.includes('/crm/deal/details/');
        console.log(`🔍 Проверка 1: Src содержит /crm/deal/details/ → ${hasValidPath ? '✅' : '❌'}`);
        
        if (!hasValidPath) {
            console.error(`❌ Невалидный src: ${iframe.src?.substring(0, 100)}...`);
            return false;
        }
        
        // Проверка 2: Src должен содержать IFRAME=Y
        const hasIframeParam = iframe.src && iframe.src.includes('IFRAME=Y');
        console.log(`🔍 Проверка 2: Src содержит IFRAME=Y → ${hasIframeParam ? '✅' : '❌'}`);
        
        if (!hasIframeParam) {
            console.error(`❌ Отсутствует параметр IFRAME=Y`);
            return false;
        }
        
        // Проверка 3: Проверяем доступность contentDocument (CORS)
        try {
            const doc = iframe.contentDocument;
            console.log(`🔍 Проверка 3: Доступ к contentDocument → ✅ (CORS разрешен)`);
            console.log(`📍 readyState: ${doc?.readyState || 'недоступно'}`);
            return true;
            
        } catch (error) {
            console.error(`🚫 Проверка 3: CORS ошибка! → ${error.message}`);
            console.error(`💥 Прекращаем поиск: iframe найден, но недоступен из-за CORS`);
            throw new Error('CORS_BLOCKED');
        }
    }
    
    async waitForIframeLoad(iframe) {
        console.log(`=== ЭТАП 4: ОЖИДАНИЕ ЗАГРУЗКИ ===`);
        
        for (let attempt = 0; attempt < this.retryCounts.load; attempt++) {
            const delay = this.retryDelays.load[attempt] || 1000;
            
            if (attempt > 0) {
                console.log(`🔄 Проверка ${attempt + 1}/${this.retryCounts.load} (через ${delay}мс)...`);
                await this.sleep(delay);
            }
            
            try {
                const doc = iframe.contentDocument;
                const state = doc?.readyState || 'unknown';
                
                console.log(`📈 Состояние загрузки: ${state}`);
                
                if (state === 'complete') {
                    console.log(`✅ Iframe полностью загружен на проверке ${attempt + 1}`);
                    return true;
                }
                
                if (attempt < this.retryCounts.load - 1) {
                    console.log(`⏳ Iframe еще загружается (${state})...`);
                }
                
            } catch (error) {
                console.error(`⚠️ Ошибка проверки состояния: ${error.message}`);
                if (attempt < this.retryCounts.load - 1) {
                    console.log(`⏳ Продолжаем попытки...`);
                }
            }
        }
        
        console.error(`❌ Iframe не завершил загрузку за ${this.retryCounts.load} проверок`);
        return false;
    }
    
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

class IframeManager {
    constructor() {
        this.currentIframe = null;
        this.isEnabled = true;
        this.hiddenCount = 0;
        this.observer = null;
        this.workerScriptUrl = chrome.runtime.getURL('iframe-worker.js');
        this.detector = new IframeDetector();
        
        this.init();
    }
    
    async init() {
        console.log('🔧 Инициализация IframeManager');
        
        // 1. Находим iframe с помощью детектора
        this.currentIframe = await this.detector.findIframe();
        
        if (this.currentIframe) {
            console.log('✅ Iframe найден, внедряем скрипт...');
            await this.injectCleanerScript(this.currentIframe);
        } else {
            console.warn('⚠️ Iframe не найден, запускаем наблюдение за DOM...');
            this.startIframeObserver();
        }
        
        // 2. Слушаем команды от popup
        this.setupMessageListener();
        
        // 3. Экспортируем для отладки
        window.bitrixManager = this;
        
        console.log('✅ IframeManager инициализирован');
    }
    
    startIframeObserver() {
        console.log('👀 Запускаем наблюдение за появлением iframe');
        
        // Наблюдаем за всем body как fallback
        this.observer = new MutationObserver(async (mutations) => {
            for (const mutation of mutations) {
                if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
                    // Быстрая проверка на iframe
                    const iframe = document.querySelector('iframe.side-panel-iframe');
                    if (iframe && iframe !== this.currentIframe) {
                        console.log('🎯 Iframe найден через Observer');
                        this.currentIframe = iframe;
                        this.observer.disconnect();
                        await this.injectCleanerScript(iframe);
                        break;
                    }
                }
            }
        });
        
        this.observer.observe(document.body, {
            childList: true,
            subtree: true
        });
        
        // Также запускаем периодическую проверку как ultimate fallback
        setTimeout(() => {
            this.periodicIframeCheck();
        }, 10000);
    }
    
    async periodicIframeCheck() {
        console.log('⏰ Запускаем периодическую проверку iframe...');
        
        const iframe = await this.detector.findIframe();
        if (iframe && !this.currentIframe) {
            console.log('✅ Iframe найден через периодическую проверку');
            this.currentIframe = iframe;
            await this.injectCleanerScript(iframe);
        } else {
            // Повторяем через 10 секунд
            setTimeout(() => {
                this.periodicIframeCheck();
            }, 10000);
        }
    }
    
    async injectCleanerScript(iframe) {
        console.log('💉 Внедряем скрипт очистки в iframe');
        
        try {
            const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
            
            const script = iframeDoc.createElement('script');
            script.src = this.workerScriptUrl;
            script.type = 'text/javascript';
            
            script.onload = () => {
                console.log('✅ Скрипт iframe-worker.js успешно загружен');
                this.initializeWorkerInIframe(iframe);
            };
            
            script.onerror = (error) => {
                console.error('❌ Ошибка загрузки iframe-worker.js:', error);
                this.tryAlternativeInjection(iframe);
            };
            
            iframeDoc.head.appendChild(script);
            
        } catch (error) {
            console.error('❌ Ошибка внедрения скрипта:', error);
            this.tryAlternativeInjection(iframe);
        }
    }
    
    initializeWorkerInIframe(iframe) {
        try {
            iframe.contentWindow.postMessage({
                type: 'bitrix-cleaner-init',
                command: 'init'
            }, '*');
            
            console.log('✅ Команда инициализации отправлена в iframe');
            
        } catch (error) {
            console.error('❌ Ошибка инициализации worker в iframe:', error);
        }
    }
    
    tryAlternativeInjection(iframe) {
        console.log('🔄 Пробуем альтернативный метод внедрения');
        
        try {
            const scriptContent = `
                // Создаем и загружаем скрипт внутри iframe
                const script = document.createElement('script');
                script.src = '${this.workerScriptUrl}';
                script.type = 'text/javascript';
                script.onload = function() {
                    console.log('✅ Скрипт загружен через альтернативный метод');
                    window.postMessage({
                        type: 'bitrix-cleaner-init',
                        command: 'init'
                    }, '*');
                };
                document.head.appendChild(script);
            `;
            
            iframe.contentWindow.eval(scriptContent);
            console.log('✅ Альтернативный метод внедрения выполнен');
            
        } catch (error) {
            console.error('❌ Все методы внедрения провалились:', error);
        }
    }
    
    setupMessageListener() {
        // Слушаем сообщения ОТ iframe
        window.addEventListener('message', (event) => {
            if (event.data && event.data.type === 'bitrix-cleaner-from-iframe') {
                this.handleIframeMessage(event.data);
            }
        });
        
        // Слушаем сообщения ОТ popup
        chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
            console.log('📨 Получено сообщение от popup:', request.action);
            
            switch (request.action) {
                case 'getStats':
                    this.sendStats(sendResponse);
                    break;
                    
                case 'toggle':
                    this.toggleCleaner(sendResponse);
                    break;
                    
                case 'hideNow':
                    this.hideNow(sendResponse);
                    break;
                    
                case 'getDebugInfo':
                    this.getDebugInfo(sendResponse);
                    break;
            }
            
            return true;
        });
    }
    
    handleIframeMessage(data) {
        switch (data.command) {
            case 'stats':
                console.log('📊 Статистика от iframe:', data.data);
                this.hiddenCount = data.data.hiddenCount || 0;
                break;
                
            case 'element-hidden':
                this.hiddenCount++;
                console.log(`🎯 Элемент скрыт, всего: ${this.hiddenCount}`);
                break;
                
            case 'error':
                console.error('❌ Ошибка в iframe:', data.data);
                break;
        }
    }
    
    sendStats(sendResponse) {
        if (this.currentIframe) {
            try {
                this.currentIframe.contentWindow.postMessage({
                    type: 'bitrix-cleaner-command',
                    command: 'get-stats'
                }, '*');
                
                const messageHandler = (event) => {
                    if (event.data && event.data.type === 'bitrix-cleaner-from-iframe' && 
                        event.data.command === 'stats') {
                        window.removeEventListener('message', messageHandler);
                        sendResponse({
                            success: true,
                            stats: event.data.data,
                            enabled: this.isEnabled,
                            iframeFound: true
                        });
                    }
                };
                
                window.addEventListener('message', messageHandler);
                
                setTimeout(() => {
                    window.removeEventListener('message', messageHandler);
                    sendResponse({
                        success: false,
                        message: 'Iframe не ответил',
                        enabled: this.isEnabled,
                        hiddenCount: this.hiddenCount,
                        iframeFound: true
                    });
                }, 1000);
                
            } catch (error) {
                sendResponse({
                    success: false,
                    message: error.message,
                    enabled: this.isEnabled,
                    hiddenCount: this.hiddenCount,
                    iframeFound: true
                });
            }
        } else {
            sendResponse({
                success: false,
                message: 'Iframe не найден',
                enabled: this.isEnabled,
                hiddenCount: this.hiddenCount,
                iframeFound: false
            });
        }
    }
    
    toggleCleaner(sendResponse) {
        this.isEnabled = !this.isEnabled;
        
        if (this.currentIframe) {
            try {
                this.currentIframe.contentWindow.postMessage({
                    type: 'bitrix-cleaner-command',
                    command: this.isEnabled ? 'enable' : 'disable'
                }, '*');
            } catch (error) {
                console.error('Ошибка отправки команды в iframe:', error);
            }
        }
        
        sendResponse({
            success: true,
            enabled: this.isEnabled
        });
    }
    
    hideNow(sendResponse) {
        if (this.currentIframe) {
            try {
                this.currentIframe.contentWindow.postMessage({
                    type: 'bitrix-cleaner-command',
                    command: 'hide-now'
                }, '*');
                
                const messageHandler = (event) => {
                    if (event.data && event.data.type === 'bitrix-cleaner-from-iframe' && 
                        event.data.command === 'hide-now-result') {
                        window.removeEventListener('message', messageHandler);
                        this.hiddenCount += event.data.data.hidden || 0;
                        sendResponse({
                            success: true,
                            hidden: event.data.data.hidden || 0,
                            total: this.hiddenCount
                        });
                    }
                };
                
                window.addEventListener('message', messageHandler);
                
                setTimeout(() => {
                    window.removeEventListener('message', messageHandler);
                    sendResponse({
                        success: false,
                        message: 'Iframe не ответил'
                    });
                }, 1000);
                
            } catch (error) {
                sendResponse({
                    success: false,
                    message: error.message
                });
            }
        } else {
            sendResponse({
                success: false,
                message: 'Iframe не найден'
            });
        }
    }
    
    getDebugInfo(sendResponse) {
        const detectorInfo = {
            selectors: this.detector.iframeSelectors,
            retryCounts: this.detector.retryCounts
        };
        
        sendResponse({
            success: true,
            debugInfo: {
                iframeFound: !!this.currentIframe,
                iframeId: this.currentIframe?.id,
                iframeSrc: this.currentIframe?.src?.substring(0, 100),
                enabled: this.isEnabled,
                hiddenCount: this.hiddenCount,
                detector: detectorInfo,
                workerScriptUrl: this.workerScriptUrl
            }
        });
    }
    
    // Методы для отладки
    getStatus() {
        return {
            iframeFound: this.currentIframe !== null,
            enabled: this.isEnabled,
            hiddenCount: this.hiddenCount,
            workerScriptUrl: this.workerScriptUrl
        };
    }
}

// Запускаем менеджер
const iframeManager = new IframeManager();

console.log('✅ Bitrix24 Auto Cleaner инициализирован');
console.log('💡 Для отладки используйте: bitrixManager.getStatus()');
console.log('💡 Для подробной отладки: chrome.runtime.sendMessage({action: "getDebugInfo"})');