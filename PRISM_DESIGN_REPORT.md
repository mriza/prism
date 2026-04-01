**PRISM**
*Professional Remote Infrastructure & Services Management*
*Easy Infrastructure and Account Management System*
Arsitektur Sistem, Technology Stack, Alur Kerja, dan Konsolidasi Fitur
**Dokumen Desain & Laporan Teknis Terkonsolidasi — Versi 0.4.4.4**
April 2026
Klasifikasi: Internal — Dokumen Teknis

**Update Terbaru**: Audit Frontend & Bug Fixes v0.4.4
- ✅ Valkey provisioning (semua 3 subtype)
- ✅ Add Database UI
- ✅ Frontend audit: 87% implementasi lengkap
- ⚠️ 2 mockup teridentifikasi (RBAC, Process Discovery)

---

## Daftar Isi
1. [Gambaran Umum Arsitektur PRISM](#1-gambaran-umum-arsitektur-prism)
2. [Technology Stack Terkini (v0.4)](#2-technology-stack-terkini-v44)
3. [Alur Kerja Sistem](#3-alur-kerja-sistem)
4. [Manajemen Resource: Projects, Accounts, & Deployments](#4-manajemen-resource-projects-accounts--deployments)
5. [Fitur Unggulan & Implementasi Teknis](#5-fitur-unggulan--implementasi-teknis)
6. [Arsitektur Keamanan & RBAC](#6-arsitektur-keamanan--rbac)
7. [Observabilitas & Pemeliharaan Data](#7-observabilitas--pemeliharaan-data)
8. [Roadmap Pengembangan (TODO)](#8-roadmap-pengembangan-todo)
9. [Lampiran: Skema Database & Detail Modal](#9-lampiran-skema-database--detail-modal)

---

## 1. Gambaran Umum Arsitektur PRISM
PRISM menggunakan arsitektur **Hub-and-Spoke** yang dioptimalkan untuk pengelolaan infrastruktur jarak jauh secara efisien.

*   **PRISM Hub (Server)**: Bertindak sebagai pusat kontrol, menyimpan state aplikasi dalam SQLite (dengan enkripsi SQLCipher), dan menyediakan API REST serta WebSocket untuk komunikasi real-time.
*   **PRISM Agent (Node)**: Binari ringan yang berjalan di setiap VM/Server target. Agent bersifat otonom dalam melakukan deteksi service, eksekusi command, dan pelaporan telemetri.
*   **Communication Layer**: Menggunakan WebSocket mTLS untuk keamanan tinggi dan efisiensi data (dengan kompresi). Agent memulai koneksi ke Hub (outbound-only) untuk menembus NAT/Firewall tanpa konfigurasi port inbound.

---

## 2. Technology Stack Terkini (v0.4)

### 2.1 Frontend: React 19 + Ant Design 5
Frontend PRISM telah dimigrasikan ke standar modern untuk performa dan UX premium:
*   **Core**: React 19 dengan Vite 7 sebagai build tool.
*   **UI Library**: Ant Design 5 yang mendukung dynamic theming (Dark Mode/Glassmorphism).
*   **Routing**: React Router 7 untuk manajemen state navigasi yang kompleks.
*   **State Management**: Kombinasi React Hooks dan Context API untuk data yang persisten antar halaman.

### 2.2 Backend (Hub): Go
Dibuat dengan efisiensi tinggi menggunakan bahasa Go:
*   **API Framework**: Native Go HTTP dengan middleware untuk security dan logging.
*   **Database**: SQLite 3 dengan SQLCipher untuk enkripsi data *at rest*.
*   **Caching**: Valkey (Redis-compatible) digunakan sebagai caching layer dan message broker internal.

### 2.3 Agent: Go (Modular Architecture)
Agent didesain untuk ekstensibilitas dengan 21+ modul service:
*   **Service Discovery**: Deteksi otomatis service yang berjalan (MySQL, Nginx, PM2, dll).
*   **Deployment Module**: Modul baru (v4.3+) yang menangani siklus hidup aplikasi dari Git release hingga reverse proxy.
*   **Telemetry**: Pengumpulan metrik resource (CPU, RAM, Disk) secara berkala.

### 2.4 Cache & Message Broker: Valkey
Dimulai dari v0.4, peran Valkey diperluas menjadi tiga kategori utama di UI:
*   **Valkey-Cache**: Optimasi performa aplikasi melalui in-memory key-value store.
*   **Valkey-Broker**: Digunakan sebagai Pub/Sub message broker untuk arsitektur microservices.
*   **Valkey-NoSQL**: Database dokumen/struktur data fleksibel untuk penyimpanan cepat.

---

## 3. Alur Kerja Sistem

### 3.1 Provisioning Service Account
1.  User memilih jenis service di **AccountFormModal**.
2.  Untuk Web Server (Caddy/Nginx), tersedia toggle **Website** (Static/Node/PHP) vs **Reverse Proxy**.
3.  Hub mengirim command `db_create_user` atau `proxy_create` ke Agent melalui WebSocket.
4.  Agent mengeksekusi aksi di level sistem operasi (config file update, user creation) dan melaporkan status kembali ke Hub.

### 3.2 Application Deployment (v4.3+)
Alur deployment otomatis dari Dashboard:
1.  **Define**: User membuat Deployment entity yang terhubung ke Repo Git.
2.  **Trigger**: User menekan tombol "Deploy".
3.  **Fetch**: Agent mendownload tarball/zip dari GitHub/GitLab release terbaru.
4.  **Install**: Agent mengekstrak file, membuat symlink `current`, dan mengatur environment variables.
5.  **Process Control**: Agent menjalankan/merestart aplikasi melalui PM2, Systemd, atau Supervisor.
6.  **Network**: Jika dikonfigurasi, Agent secara otomatis membuat rule reverse proxy di Caddy/Nginx untuk domain aplikasi tersebut.

---

## 4. Manajemen Resource: Projects, Accounts, & Deployments

PRISM menggunakan hierarki resource untuk organisasi yang rapi:
*   **Project**: Container utama untuk resource.
*   **Service Account**: Kredensial spesifik database/storage (mysql user, s3 bucket).
*   **Deployment**: Status dan konfigurasi deployment aplikasi dari Git.
*   **Management Credential**: Kredensial root/admin yang dienkripsi untuk akses Agent ke sistem (seperti password database root).

---

## 5. Fitur Unggulan & Implementasi Teknis

### 5.1 Configuration Drift Detection
Sistem secara otomatis mengambil snapshot konfigurasi service dan mendeteksi jika ada perubahan manual di server yang tidak melalui PRISM Dashboard. Fitur ini krusial untuk menjaga konsistensi infrastruktur.

### 5.2 Centralized Webhooks
Tersedia sistem webhook untuk integrasi dengan tool eksternal (Slack, Discord, CI/CD). Setiap event penting (deployment success, agent down, account deleted) dapat memicu pengiriman payload JSON ke URL tujuan.

### 5.3 Data Retention & Automated Cleanup
Implementasi kebijakan retensi otomatis untuk tabel Telemetri dan Audit Log guna menjaga ukuran database tetap terkontrol dan performa Hub tetap optimal.

---

## 6. Arsitektur Keamanan & RBAC

PRISM menerapkan standar keamanan tinggi:
*   **Granular RBAC**: Izin akses yang sangat spesifik hingga level resource server atau project tertentu. User dapat diberikan role `Manager` hanya untuk server di lokasi 'ID-JKT'.
*   **SQLCipher Encryption**: Database Hub dilindungi oleh enkripsi AES-256 yang membutuhkan kunci pada saat aplikasi startup.
*   **mTLS Connection**: Komunikasi antara Agent dan Hub diamankan dengan sertifikat TLS dua arah yang dikelola secara otomatis oleh Hub.

---

## 7. Observabilitas & Pemeliharaan Data

*   **Activity Logs**: Audit trail yang tidak dapat diubah (immutable) untuk setiap aksi yang dilakukan user.
*   **Real-time Metrics**: Visualisasi penggunaan resource server secara langsung melalui dashboard.
*   **Health Checks**: Endpoint `/health` dan `/ready` pada Hub dan Agent untuk monitoring oleh uptime tools eksternal.

---

## 8. Roadmap Pengembangan (TODO)

Beberapa fitur yang saat ini dalam tahap perencanaan atau implementasi parsial:
*   **Runtime Environment Manager**: Deteksi otomatis dan instalasi runtime (NodeJS, Python, PHP) di VM melalui Agent.
*   **SSL/TLS Auto-Provisioning**: Integrasi Let's Encrypt otomatis untuk semua aplikasi yang di-deploy melalui PRISM.
*   **Real-time Log Streaming**: Streaming file log aplikasi langsung ke UI Dashboard melalui WebSocket.
*   **API Key Auth**: Dukungan autentikasi API Key untuk memicu deployment dari pipeline CI/CD eksternal.
*   **Backup & Restore Tooling**: Sistem backup terintegrasi untuk database service yang dikelola.

---

## 9. Lampiran: Skema Database & Detail Modal

### 9.1 Tabel Utama (v0.4)
*   `deployments`: Menyimpan info repositori, versi aplikasi, dan status deployment.
*   `permissions` & `role_permissions`: Struktur data untuk RBAC granular.
*   `webhook_subscriptions`: Konfigurasi pengiriman notifikasi eksternal.
*   `configuration_snapshots`: Data snapshot untuk deteksi drift.

### 9.2 Detail Modal
*   **AccountFormModal**: Kini mendukung filter dinamis untuk Valkey-Cache, Broker, dan NoSQL.
*   **DeploymentFormModal**: Input komprehensif untuk runtime environment, environment variables, dan network proxy mapping.

---
*Dokumen ini diperbarui secara berkala mengikuti perkembangan rilis PRISM.*
