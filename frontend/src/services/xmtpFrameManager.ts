const IFRAME_URL = 'https://sandbox-629a5.web.app';

type SignMessageFn = (message: string) => Promise<string>;

interface InitClientPayload {
  address: string;
  signMessage: SignMessageFn;
}

class XmtpFrameManager {
  private iframe: HTMLIFrameElement | null = null;
  private isFrameLoaded = false;
  private isClientReady = false;
  private taskQueue: (() => void)[] = [];
  
  private address: string | null = null;
  private signMessage: SignMessageFn | null = null;
  
  public onReady: (() => void) | null = null;
  public onClientError: ((error: Error) => void) | null = null;
  public onHistoryResponse: ((history: any[]) => void) | null = null;
  public onHistoryError: ((error: Error) => void) | null = null;

  constructor() {
    window.addEventListener('message', (event) => this.handleMessage(event));
  }
  
  private async handleMessage(event: MessageEvent) {
    if (event.origin !== IFRAME_URL) return;

    console.log('[Frame Manager] Received message from iframe:', event.data);
    const { type, payload, message, requestId } = event.data;
    
    switch (type) {
      case 'frameLoaded':
        console.log('[Frame Manager] Frame loaded notification received');
        this.isFrameLoaded = true;
        this.processTaskQueue();
        break;
      case 'clientReady':
        console.log('[Frame Manager] Client ready notification received');
        this.isClientReady = true;
        this.onReady?.();
        this.processTaskQueue();
        break;
      case 'clientError':
        this.onClientError?.(new Error(payload?.message || 'Unknown client error'));
        break;
      case 'requestSignature':
        if (!this.signMessage) {
          const errorMsg = 'Signing function not available.';
          console.error(`[Frame Manager] ${errorMsg}`);
          this.postMessage({ type: 'signatureResponse', error: errorMsg, requestId });
          return;
        }
        try {
          console.log('[Frame Manager] Processing signature request...');
          const signature = await this.signMessage(message);
          console.log('[Frame Manager] Signature obtained, sending response');
          this.postMessage({ type: 'signatureResponse', signature, requestId });
        } catch (err: any) {
          console.error('[Frame Manager] Signing failed:', err);
          const errorMessage = err instanceof Error ? err.message : 'Unknown signing error';
          this.postMessage({ type: 'signatureResponse', error: errorMessage, requestId });
        }
        break;
      case 'historyResponse':
        this.onHistoryResponse?.(payload);
        break;
      case 'historyError':
        this.onHistoryError?.(new Error(payload?.message || 'Unknown history error'));
        break;
    }
  }

  private createIframe() {
    if (this.iframe) return;
    console.log('[Frame Manager] Creating iframe...');
    const iframe = document.createElement('iframe');
    iframe.src = IFRAME_URL;
    iframe.style.display = 'none';
    document.body.appendChild(iframe);
    this.iframe = iframe;
    console.log('[Frame Manager] Iframe created and added to DOM');
  }

  private postMessage(message: any) {
    console.log('[Frame Manager] Sending message to iframe:', message);
    if (this.iframe?.contentWindow) {
      this.iframe.contentWindow.postMessage(message, IFRAME_URL);
    } else {
      console.error('[Frame Manager] Cannot send message: iframe or contentWindow not available');
    }
  }
  
  private addTask(task: () => void) {
    console.log('[Frame Manager] Adding task to queue. Current queue length:', this.taskQueue.length);
    this.taskQueue.push(task);
    this.processTaskQueue();
  }

  private processTaskQueue() {
    console.log('[Frame Manager] Processing task queue. isFrameLoaded:', this.isFrameLoaded, 'queue length:', this.taskQueue.length);
    if (this.isFrameLoaded) {
      while(this.taskQueue.length > 0) {
        const task = this.taskQueue.shift();
        if (!task) continue;

        console.log('[Frame Manager] Executing task:', task.name || 'unnamed task');
        if (task.name === 'initClientTask' || this.isClientReady) {
          task();
        } else {
          console.log('[Frame Manager] Task requires client ready, putting back in queue');
          this.taskQueue.unshift(task);
          break; 
        }
      }
    } else {
      console.log('[Frame Manager] Frame not loaded yet, keeping tasks in queue');
    }
  }

  // --- Public API ---

  public initClient({ address, signMessage }: InitClientPayload) {
    this.address = address;
    this.signMessage = signMessage;
    this.createIframe();
    
    const initClientTask = () => {
      console.log('[Frame Manager] Executing initClient task');
      const dbEncryptionKey = window.crypto.getRandomValues(new Uint8Array(32));
      this.postMessage({ 
        type: 'initClient', 
        payload: { 
          walletAddress: this.address,
          dbEncryptionKey: Array.from(dbEncryptionKey),
        }
      });
    };
    // Add name property to function for identification
    Object.defineProperty(initClientTask, 'name', { value: 'initClientTask' });
    this.addTask(initClientTask);
  }
  
  public fetchHistory() {
    const fetchHistoryTask = () => this.postMessage({ type: 'fetchHistory', payload: {} });
    this.addTask(fetchHistoryTask);
  }

  public disconnect() {
    if (this.iframe) {
        document.body.removeChild(this.iframe);
        this.iframe = null;
    }
    this.isFrameLoaded = false;
    this.isClientReady = false;
    this.address = null;
    this.signMessage = null;
    this.taskQueue = [];
    console.log('[Frame Manager] Disconnected and cleaned up.');
  }
}

const xmtpFrameManager = new XmtpFrameManager();
export { xmtpFrameManager }; 