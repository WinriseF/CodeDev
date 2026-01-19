use std::sync::Mutex;
use std::time::Duration;
use tauri::{AppHandle, Manager, WebviewUrl, WebviewWindowBuilder, Emitter};
use tauri::async_runtime::JoinHandle;
use serde::{Deserialize, Serialize};

// 休眠配置结构体
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HibernateConfig {
    pub enable: bool,
    pub duration_minutes: u64,
}

impl Default for HibernateConfig {
    fn default() -> Self {
        Self {
            enable: false,
            duration_minutes: 10, // 默认10分钟
        }
    }
}

// 用于管理定时器任务的状态
pub struct HibernateState {
    pub config: Mutex<HibernateConfig>,
    timer_handle: Mutex<Option<JoinHandle<()>>>,
}

impl HibernateState {
    pub fn new() -> Self {
        Self {
            config: Mutex::new(HibernateConfig::default()),
            timer_handle: Mutex::new(None),
        }
    }
}

// 停止当前的休眠倒计时（用户重新聚焦或操作时调用）
pub fn cancel_hibernate_timer(app_handle: &AppHandle) {
    let state = app_handle.state::<HibernateState>();
    let mut handle_guard = state.timer_handle.lock().unwrap();

    if let Some(handle) = handle_guard.take() {
        handle.abort();
        // println!("[Hibernate] 用户活跃，已取消休眠倒计时");
    }
}

// 启动休眠倒计时（失去焦点时调用）
pub fn start_hibernate_timer(app_handle: &AppHandle) {
    let state = app_handle.state::<HibernateState>();
    let config = state.config.lock().unwrap().clone();

    // 如果未开启功能，直接返回
    if !config.enable {
        return;
    }

    // 先取消旧的（防抖）
    let mut handle_guard = state.timer_handle.lock().unwrap();
    if let Some(handle) = handle_guard.take() {
        handle.abort();
    }

    let app_handle_clone = app_handle.clone();
    let duration = Duration::from_secs(config.duration_minutes * 60);

    // 启动异步任务
    let handle = tauri::async_runtime::spawn(async move {
        // println!("[Hibernate] 开始休眠倒计时: {} 分钟", config.duration_minutes);
        tokio::time::sleep(duration).await;

        // 时间到，执行销毁
        destroy_main_window(&app_handle_clone);
    });

    *handle_guard = Some(handle);
}

// 销毁主窗口（释放内存的核心）
pub fn destroy_main_window(app_handle: &AppHandle) {
    if let Some(window) = app_handle.get_webview_window("main") {
        println!("[Hibernate] 倒计时结束，销毁主窗口以释放内存");

        // 可选：在销毁前发送事件给前端保存临时数据（虽然Zustand persist已处理大部分）
        let _ = window.emit("prepare-for-sleep", ());

        // 稍微等待前端处理（可选，视情况而定）
        // std::thread::sleep(std::time::Duration::from_millis(100));

        // 核心操作：销毁
        if let Err(e) = window.destroy() {
            eprintln!("[Hibernate] 销毁窗口失败: {}", e);
        }
    }
}

// 重建主窗口（托盘点击时调用）
pub fn recreate_main_window(app_handle: &AppHandle) {
    println!("[Hibernate] 正在重建主窗口...");

    // 确保之前的窗口确实没了
    if app_handle.get_webview_window("main").is_some() {
        return;
    }

    // 根据 tauri.conf.json 的配置手动重建窗口
    // 注意：这里的配置必须与你的 tauri.conf.json 保持一致
    let builder = WebviewWindowBuilder::new(
        app_handle,
        "main",
        WebviewUrl::App("index.html".into())
    )
    .title("CtxRun")
    .inner_size(800.0, 600.0)
    .resizable(true)
    .fullscreen(false)
    .decorations(false) // 无边框
    .transparent(true)  // 透明背景
    .center()
    .shadow(false) // 根据你的配置
    .visible(false); // 先隐藏，加载完再显示

    match builder.build() {
        Ok(window) => {
            // 可以在这里设置一些初始化脚本或事件

            // 显示并聚焦
            let _ = window.show();
            let _ = window.set_focus();
            println!("[Hibernate] 主窗口重建成功");
        }
        Err(e) => {
            eprintln!("[Hibernate] 重建窗口失败: {}", e);
        }
    }
}

// 更新配置的命令
#[tauri::command]
pub fn update_hibernate_config(
    state: tauri::State<HibernateState>,
    enable: bool,
    duration: u64
) -> Result<(), String> {
    let mut config = state.config.lock().map_err(|e| e.to_string())?;
    config.enable = enable;
    config.duration_minutes = duration;

    // 如果关闭了功能，立即取消当前的计时器
    if !enable {
        let mut handle = state.timer_handle.lock().map_err(|e| e.to_string())?;
        if let Some(h) = handle.take() {
            h.abort();
        }
    }

    Ok(())
}

// 获取当前配置的命令
#[tauri::command]
pub fn get_hibernate_config(state: tauri::State<HibernateState>) -> Result<HibernateConfig, String> {
    let config = state.config.lock().map_err(|e| e.to_string())?;
    Ok(config.clone())
}
