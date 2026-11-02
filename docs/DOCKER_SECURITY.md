# CyberEdu Platform — Docker va Xost Xavfsizligini Kuchaytirish Qo'llanmasi (DOCKER_SECURITY.md)

Ushbu hujjat **CyberEdu** kiberxavfsizlik o'quv platformasining ishlab chiqarish (production) serverini xakerlik hujumlaridan, talabalar tomonidan konteynerdan xost tizimiga chiqib ketish (container breakout) urinishlaridan va ruxsatsiz kirishlardan himoyalash bo'yicha to'liq qo'llanmadir.

> [!CAUTION]
> **Eng muhim qoida:** Talabalar ushbu platformada aynan kiberhujumlarni va ekspluatatsiyani mashq qiladi. Shuning uchun platformaning o'zi birinchi nishon hisoblanadi. Har qanday xavfsizlik cheklovini chetlab o'tishning oldi olingan bo'lishi shart!

---

## 1. Rootless Docker yoki User Namespace Remapping (userns-remap)

Standart Docker demoni (`dockerd`) xost tizimida **root** huquqi bilan ishlaydi. Agar talaba Linux terminal yoki veb-lab konteyneridan qandaydir 0-day zaiflik orqali chiqib ketsa, u xostda ham root huquqiga ega bo'lib qolishi mumkin. 

Buning oldini olish uchun ikkita asosiy yechim mavjud:

### Variant A: User Namespace Remapping (`userns-remap`) — TAVSIYA ETILADI

Konteyner ichidagi UID 0 (root) xost tizimidagi imtiyozsiz UID (masalan, 100000) ga moslashtiriladi.

1. `/etc/subuid` va `/etc/subgid` fayllarini tekshiring:
```bash
sudo grep dockremap /etc/subuid /etc/subgid
# Agar mavjud bo'lmasa, qo'shing:
sudo groupadd -r dockremap
sudo useradd -r -g dockremap dockremap
echo "dockremap:100000:65536" | sudo tee -a /etc/subuid
echo "dockremap:100000:65536" | sudo tee -a /etc/subgid
```

2. `/etc/docker/daemon.json` fayliga quyidagi qat'iy xavfsizlik parametrlarini yozing:
```json
{
  "userns-remap": "dockremap",
  "icc": false,
  "no-new-privileges": true,
  "live-restore": true,
  "log-driver": "json-file",
  "log-opts": {
    "max-size": "10m",
    "max-file": "5"
  }
}
```

3. Docker demonini qayta ishga tushiring:
```bash
sudo systemctl restart docker
```

---

### Variant B: Rootless Docker (Root huquqisiz Docker)

Rootless rejimda Docker xost tizimidagi oddiy foydalanuvchi hisobi ostida ishlaydi:
```bash
# 1. Kerakli paketlarni o'rnatish (Ubuntu/Debian)
sudo apt-get install -y uidmap dbus-user-session

# 2. Maxsus izolyatsiyalangan foydalanuvchi yaratish
sudo useradd -m -s /bin/bash cyberedu-runner
sudo loginctl enable-linger cyberedu-runner
sudo -u cyberedu-runner -i

# 3. Rootless Dockerni o'rnatish
dockerd-rootless-setuptool.sh install

# 4. Tizim servisi sifatida faollashtirish
systemctl --user enable docker
systemctl --user start docker
```

---

## 2. Xost Xavfsizlik Devori (Host Firewall: UFW / iptables)

> [!WARNING]
> **Docker va UFW muammosi:** Standart Docker o'zining `iptables` qoidalarini UFW dan oldin qo'yadi. Natijada `ports: - "5432:5432"` deb yozilgan konteyner UFW bloklagan bo'lsa ham butun internetga ochilib qoladi!

### Himoya choralari:
1. `docker-compose.yml` da hech qachon Postgres yoki Sidecar portlarini xostga ochmang (`ports` o'rniga faqat `internal: true` tarmoqlardan foydalaning).
2. Xostda UFW ni qat'iy sozlang:

```bash
# Standart siyosat: Kirishni butunlay yopish, chiqishga ruxsat berish
sudo ufw default deny incoming
sudo ufw default allow outgoing

# Faqat xavfsiz portlarga ruxsat berish
sudo ufw allow 22/tcp comment 'SSH boshqaruvi'
sudo ufw allow 80/tcp comment 'HTTP (Caddy/Nginx ACME sertifikati)'
sudo ufw allow 443/tcp comment 'HTTPS (Asosiy xizmat)'

# UFW ni yoqish
sudo ufw enable
sudo ufw status verbose
```

3. Qo'shimcha ravishda `ufw-docker` skriptini o'rnatish tavsiya etiladi:
```bash
sudo wget -O /usr/local/bin/ufw-docker https://github.com/chaifeng/ufw-docker/raw/master/ufw-docker
sudo chmod +x /usr/local/bin/ufw-docker
sudo ufw-docker install
```

---

## 3. SSH Kirishini Qat'iy Kuchaytirish (Hardening)

Ishlab chiqarish serveriga ruxsatsiz kirishning oldini olish uchun:

1. `/etc/ssh/sshd_config` faylini tahrirlang:
```ini
# Parol orqali kirishni butunlay o'chirish (Faqat SSH kalitlar)
PasswordAuthentication no
ChallengeResponseAuthentication no

# Root foydalanuvchisi to'g'ridan-to'g'ri kira olmasin
PermitRootLogin no

# Faqat ruxsat etilgan xavfsiz foydalanuvchilarga ruxsat berish
AllowUsers cyberadmin

# Maksimal autentifikatsiya urinishlari soni
MaxAuthTries 3

# SSH portini standart 22 dan boshqa raqamga o'zgartirish (masalan: 2222)
Port 2222
```

2. Fail2ban o'rnatish va faollashtirish (Brute-force hujumlariga qarshi):
```bash
sudo apt-get install -y fail2ban
sudo systemctl enable fail2ban
sudo systemctl start fail2ban
```

---

## 4. Alohida VPS Tavsiyasi (Defence-in-Depth Arxitekturasi)

O'quv markazida 20 dan ortiq real talabalar parallel ravishda kiberxavfsizlik lablarini bajarganda, eng xavfsiz amaliyot quyidagicha:

```
[ Internet ]
     │
     ▼ (HTTPS)
[ VPS 1: Frontend & DB ]
  • Next.js App (cyberedu.uz)
  • PostgreSQL 16 (Baza)
  • Caddy / Nginx TLS Proxy
     │
     │  (Faqat shifrlangan mTLS / WireGuard tunnel orqali)
     │  (HMAC SHA-256 imzolangan buyruqlar: SIDECAR_SECRET)
     ▼
[ VPS 2: Izolyatsiyalangan Sandbox Worker ]
  • CyberEdu Sandbox Daemon (port 5055, faqat tunnelda)
  • Talabalar Linux konteynerlari (pids-limit, no-network, read-only)
  • Talabalar Veb-lab konteynerlari (cyberedu-weblab-net)
```

### Afzalliklari:
1. **To'liq fizik/virtual izolyatsiya:** Agar talaba Linux konteyneridan xostga chiqishga muvaffaq bo'lsa ham, u faqat ikkilamchi Sandbox serverida qoladi. Asosiy ma'lumotlar bazasi, foydalanuvchi hisoblari va platforma sirlari unga mutlaqo yetib bormaydi.
2. **Resurslar kafolati:** Talabalar og'ir skriptlar yoki fork-bombalar ishga tushirganda, asosiy ta'lim portali va veb-sayt sekinlashmaydi.
3. **Audit va qayta tiklash:** Har qanday shubhali holatda Sandbox worker serverini bir zumda tozalash yoki snapshot orqali qayta tiklash mumkin.
