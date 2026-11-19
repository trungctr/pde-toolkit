//! `chillcat-server` – tiến trình monolith của ChillCat Studio.
//!
//! Cấu hình qua biến môi trường (xem `backend/.env.example`). Chạy:
//! ```text
//! cargo run -p chillcat-server
//! ```

mod app;

use chillcat_platform::config::Settings;
use chillcat_platform::Mongo;
use tracing_subscriber::EnvFilter;

#[tokio::main]
async fn main() {
    let _ = dotenvy::dotenv();
    let filter = EnvFilter::try_from_default_env().unwrap_or_else(|_| EnvFilter::new("info,tower_http=info,mongodb=warn"));
    if std::env::var("LOG_FORMAT").is_ok_and(|f| f.eq_ignore_ascii_case("json")) {
        tracing_subscriber::fmt().with_env_filter(filter).json().init();
    } else {
        tracing_subscriber::fmt().with_env_filter(filter).init();
    }
    if let Err(e) = run().await {
        tracing::error!(error = %e, "Không khởi động được máy chủ");
        std::process::exit(1);
    }
}

async fn run() -> chillcat_kernel::AppResult<()> {
    let settings = Settings::from_env()?;
    let mongo = Mongo::connect(&settings).await?;
    tracing::info!(db = %settings.mongo.database, "Đã kết nối MongoDB");
    let app = app::build(&settings, mongo).await?;

    let (stop_tx, stop_rx) = tokio::sync::watch::channel(false);
    let relay = tokio::spawn(app.relay.run(stop_rx.clone()));
    app::spawn_jobs(app.jobs, stop_rx);

    let listener = tokio::net::TcpListener::bind(&settings.http.addr)
        .await
        .map_err(|e| chillcat_kernel::AppError::internal(format!("Không mở được cổng {}: {e}", settings.http.addr)))?;
    tracing::info!(addr = %settings.http.addr, url = %settings.http.public_base_url, "ChillCat Studio đang chạy");
    axum::serve(listener, app.router)
        .with_graceful_shutdown(async {
            shutdown_signal().await;
            tracing::info!("Đang dừng…");
        })
        .await?;
    let _ = stop_tx.send(true);
    let _ = relay.await;
    Ok(())
}

/// Ctrl+C (máy phát triển) hoặc SIGTERM (`docker stop`, Kubernetes): dừng nhận yêu cầu mới, chờ yêu cầu đang chạy xong.
/// Thiếu SIGTERM thì Docker giết tiến trình sau 10 giây mà không tắt êm.
async fn shutdown_signal() {
    let ctrl_c = async {
        let _ = tokio::signal::ctrl_c().await;
    };
    #[cfg(unix)]
    let terminate = async {
        match tokio::signal::unix::signal(tokio::signal::unix::SignalKind::terminate()) {
            Ok(mut s) => {
                s.recv().await;
            }
            Err(e) => {
                tracing::warn!(error = %e, "Không nghe được SIGTERM");
                std::future::pending::<()>().await;
            }
        }
    };
    #[cfg(not(unix))]
    let terminate = std::future::pending::<()>();
    tokio::select! {
        _ = ctrl_c => {},
        _ = terminate => {},
    }
}
