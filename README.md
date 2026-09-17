# Suannaree

เว็บบันทึกรายรับ–รายจ่ายสำหรับร้านสรวลนารี ประกอบด้วยหน้าเว็บแบบ static และ Google Apps Script ที่ทำหน้าที่เป็น API เชื่อมกับ Google Sheet

## โครงสร้างไฟล์

```text
.
├── index.html
├── config.js
├── config.example.js
├── apps-script/
│   └── Code.gs
├── README.md
└── .gitignore
```

ไฟล์ `config.js` ถูกเก็บใน repository เพื่อให้ GitHub Pages โหลด API URL ได้โดยตรง URL นี้ไม่ใช่ความลับและผู้ใช้เว็บสามารถเห็นได้จาก Network tab อยู่แล้ว ความปลอดภัยหลักจึงอยู่ที่การตรวจ session token ใน Apps Script ทุก action

## 1. เตรียม Google Sheet และ Apps Script

1. สร้าง Google Sheet ใหม่ หรือเปิด Sheet ที่ต้องการใช้เก็บข้อมูล
2. ไปที่ **ส่วนขยาย (Extensions) → Apps Script** เพื่อสร้าง Apps Script ที่ผูกกับ Sheet นี้
3. เปิดไฟล์ `apps-script/Code.gs` จาก repository แล้วคัดลอกโค้ดทั้งหมดไปแทนที่โค้ดในไฟล์ `Code.gs` บน Apps Script
4. กด **บันทึก (Save)**
5. ตั้ง Time zone ของโปรเจกต์ Apps Script ให้ตรงกับพื้นที่ใช้งาน เช่น `Asia/Bangkok`

เมื่อมีการบันทึกรายการครั้งแรก ระบบจะสร้างชีตชื่อ `Transactions` และหัวตารางให้อัตโนมัติ

## 2. ตั้งรหัสผ่านด้วย Script Properties

ห้ามเขียนรหัสผ่านลงใน `index.html`, `Code.gs`, `config.js` หรือไฟล์อื่นใน repository

1. ในหน้า Apps Script เลือก **Project Settings** (ไอคอนรูปเฟือง)
2. เลื่อนลงไปที่ **Script Properties**
3. กด **Add script property**
4. ตั้งชื่อ Property เป็น `APP_PASSWORD`
5. ใส่รหัสผ่านที่คาดเดายากในช่อง Value
6. กด **Save script properties**

ตัวเว็บจะส่งรหัสผ่านผ่าน HTTPS ไปตรวจที่ Apps Script รหัสผ่านจริงจึงไม่อยู่ใน source code ฝั่งหน้าเว็บ

## 3. Deploy Apps Script เป็น Web app

1. ในหน้า Apps Script กด **Deploy → New deployment**
2. กดไอคอนรูปเฟืองข้าง **Select type** แล้วเลือก **Web app**
3. ตั้ง **Execute as** เป็น **Me**
4. ตั้ง **Who has access** เป็น **Anyone** เพื่อให้หน้าเว็บเรียก API ได้
5. กด **Deploy** และอนุญาตสิทธิ์ที่ Apps Script ต้องใช้
6. คัดลอก **Web app URL** ที่ลงท้ายด้วย `/exec` ไปใช้ใน `config.js` เท่านั้น

แม้ Web app จะเปิดให้ Anyone เข้าถึง endpoint ได้ แต่การอ่าน เพิ่ม และยกเลิกรายการต้องผ่านการตรวจรหัสที่เซิร์ฟเวอร์และ session token ก่อน

### เมื่อแก้ Code.gs ภายหลัง

ไปที่ **Deploy → Manage deployments** เลือก deployment ปัจจุบัน กด **Edit** เลือก **New version** แล้วกด **Deploy** วิธีนี้มักคง URL เดิมไว้

### วิธีปิด deployment เก่า

1. ไปที่ **Deploy → Manage deployments**
2. เลือก deployment เก่าที่ไม่ใช้งาน
3. กดไอคอน **Archive deployment**
4. ตรวจว่า URL เก่าเรียกใช้งานไม่ได้แล้ว

ควรปิด deployment เก่าทุกครั้งเมื่อเปลี่ยน URL หรือสงสัยว่า URL/session เดิมถูกนำไปใช้โดยไม่ได้รับอนุญาต และควรเปลี่ยน `APP_PASSWORD` พร้อมกัน

## 4. ตั้งค่า config.js

แก้ `config.js` ให้ใช้ Web app URL ของ deployment ปัจจุบัน หากเริ่มติดตั้งใหม่ สามารถคัดลอก `config.example.js` เป็น `config.js` แล้วแทนค่าตัวอย่างได้

```javascript
window.APP_CONFIG = {
  API_URL: "วาง Web app URL ที่ลงท้ายด้วย /exec ที่นี่"
};
```

ต้อง commit `config.js` ไปพร้อมหน้าเว็บ เพื่อให้ GitHub Pages ใช้งานได้

สำหรับการทดสอบในเครื่อง ให้เปิดเว็บผ่าน local web server แทนการดับเบิลคลิก `index.html` โดยตรง เพื่อให้พฤติกรรมใกล้เคียงกับตอน deploy จริง

## 5. นำหน้าเว็บขึ้น GitHub Pages

1. Push `index.html`, `config.js` และไฟล์อื่นทั้งหมดขึ้น repository
2. ไปที่ **Settings → Pages**
3. ในหัวข้อ **Build and deployment** เลือก **Deploy from a branch**
4. เลือก branch ที่ใช้งานและโฟลเดอร์ `/ (root)` แล้วกด **Save**
5. เปิด URL ของ GitHub Pages และทดสอบเข้าสู่ระบบ

> URL ของ API ที่ถูกเรียกจาก browser ไม่สามารถเป็นความลับได้ ผู้ใช้สามารถดู URL จาก Network tab ได้เสมอ ตัวป้องกันหลักคือ Apps Script ต้องตรวจ session token ในทุก action ที่อ่านหรือแก้ไขข้อมูล

## 6. การยกเลิกรายการ

- ระบบไม่ลบแถวออกจาก Google Sheet
- เมื่อยกเลิก ระบบบันทึกเวลาไว้ในคอลัมน์ `cancelledAt` และเหตุผลใน `cancelReason`
- รายการที่ยกเลิกยังแสดงในประวัติพร้อมเครื่องหมายและเหตุผล
- รายการที่ยกเลิกจะไม่ถูกนำไปคำนวณรายรับ รายจ่าย คงเหลือ หรือยอดแยกหมวดหมู่
- Apps Script จะเพิ่มหัวคอลัมน์ใหม่ให้ Sheet เดิมโดยอัตโนมัติ

## 7. การทำงานด้านความปลอดภัย

- รหัสผ่านถูกอ่านจาก Script Property ชื่อ `APP_PASSWORD` เท่านั้น
- หลังล็อกอินสำเร็จ Apps Script จะออก session token ที่มีอายุประมาณ 6 ชั่วโมง
- token ถูกเก็บใน `sessionStorage` และหายไปเมื่อปิด tab/browser session
- การอ่าน เพิ่ม และยกเลิกรายการต้องมี session token ที่ยังใช้งานได้
- ฝั่ง Apps Script ตรวจชนิดรายการ หมวดหมู่ จำนวนเงิน วันที่ และความยาวรายละเอียดอีกครั้ง
- ห้ามใช้การซ่อน URL หรือ JavaScript ฝั่ง browser แทนการตรวจสิทธิ์บนเซิร์ฟเวอร์

## เช็กลิสต์ก่อนเผยแพร่

- ตั้ง `APP_PASSWORD` ใน Script Properties แล้ว
- ตั้ง Time zone ของ Apps Script ถูกต้อง
- Deploy เวอร์ชันล่าสุดและปิด deployment เก่าแล้ว
- `config.js` มี Web app URL ของ deployment ปัจจุบันและถูก commit สำหรับ GitHub Pages
- ทดสอบล็อกอินด้วยรหัสที่ถูกและผิด
- ทดสอบเพิ่ม อ่าน และยกเลิกรายการ พร้อมตรวจว่าแถวเดิมยังอยู่ใน Sheet
- ตรวจว่ารายการที่ยกเลิกมีทั้ง `cancelledAt` และ `cancelReason`
- ตรวจว่ารายการที่ยกเลิกไม่ถูกรวมในยอดทุกส่วน
- ตรวจว่าไม่มีรหัสผ่านจริงหรือ session token อยู่ใน commit
