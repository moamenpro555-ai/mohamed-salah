// ================== لوحة المدرس: الحصص (فيديو لوحده، من غير كورس) ==================
// الحصة = كارت (عنوان + غلاف + سعر/كود) فيه فيديو واحد. بيتحمّل بعد teacher.js.
(function () {
    "use strict";
    var ui = window.TeacherUI;
    if (!ui) return;
    var E = ui.E, h = E.h, run = ui.run, field = ui.field, option = ui.option;
    var MODES = [["free", "مجاني (أي طالب يفتحها بضغطة)"], ["paid", "فوري (دفع بفودافون كاش + صورة الإيصال)"], ["code", "كود (الطالب بيدخل كود إنت إديته له)"], ["code_or_paid", "كود وفوري معًا"]];
    var MODE_SHORT = { free: "مجاني", paid: "فوري", code: "كود", code_or_paid: "كود وفوري" };
    var editingId = null;

    function body() { return ui.getBody(); }
    function short(u) { try { var x = new URL(u); return x.hostname.replace(/^www\./, "") + (x.pathname.length > 1 ? "/…" : ""); } catch (e) { return u || "-"; } }

    // نموذج إضافة / تعديل حصة (s = null يعني حصة جديدة)
    function sessionForm(s) {
        var title = h("input", { id: "ss_title", maxlength: "200", required: true, value: s ? s.title : "" });
        var desc = h("textarea", { id: "ss_desc", maxlength: "2000" }); desc.value = s ? s.description : "";
        var stage = ui.placeStage("ss_stage", s ? s.stage : "secondary");
        var grade = ui.placeGrade("ss_grade", s ? s.grade : 1);
        var video = h("input", { id: "ss_video", type: "url", dir: "ltr", maxlength: "2000", required: true, placeholder: "https://youtu.be/... أو رابط Google Drive أو MP4", value: s ? s.videoRef : "" });
        var mode = h("select", { id: "ss_mode" }, MODES.map(function (m) { return option(m[0], m[1], (s ? s.accessMode : "code") === m[0]); }));
        var price = h("input", { id: "ss_price", type: "number", min: "0", max: "100000", step: "1", dir: "ltr", value: s ? String(s.price || 0) : "0" });
        var priceRow = field("سعر الحصة بالجنيه", "ss_price", price);
        function sync() { var paid = mode.value === "paid" || mode.value === "code_or_paid"; priceRow.forEach(function (n) { n.style.display = paid ? "" : "none"; }); }
        mode.addEventListener("change", sync);
        var cover = h("input", { id: "ss_cover", type: "file", accept: "image/png,image/jpeg,image/webp" });
        var pdf = h("input", { id: "ss_pdf", type: "file", accept: "application/pdf" });
        var pub = h("input", { type: "checkbox", id: "ss_pub" }); pub.checked = s ? s.isPublished : true;
        var msg = h("p", { class: "ac_msg", role: "alert" });
        var go = h("button", { type: "submit", class: "ac_btn b_dark", text: s ? "حفظ التعديل" : "إضافة الحصة" });
        var form = h("form", { class: "ac_form", novalidate: true }, [].concat(
            field("اسم الحصة", "ss_title", title),
            field("وصف مختصر (اختياري)", "ss_desc", desc),
            field("المرحلة", "ss_stage", stage), field("الصف", "ss_grade", grade),
            field("رابط الفيديو (يوتيوب أو درايف أو MP4)", "ss_video", video),
            field("طريقة الاشتراك", "ss_mode", mode), priceRow,
            field("صورة الغلاف (اختياري - PNG أو JPG أو WebP أقل من 1 ميجا)", "ss_cover", cover),
            field("ملف PDF للحصة (اختياري - أقل من 8 ميجا)", "ss_pdf", pdf),
            [h("label", { class: "ac_check" }, [pub, h("span", { text: "منشورة (تظهر للطلاب)" })]), msg,
                h("div", { class: "ac_row" }, [go].concat(s ? [h("button", { type: "button", class: "ac_btn b_line", text: "إلغاء", onclick: function () { editingId = null; sessionsView(); } })] : []))]
        ));
        sync();
        form.addEventListener("submit", async function (ev) {
            ev.preventDefault(); msg.textContent = "";
            if (!title.value.trim()) { msg.textContent = "اكتب اسم الحصة."; return; }
            if (!video.value.trim()) { msg.textContent = "حط رابط الفيديو."; return; }
            var paid = mode.value === "paid" || mode.value === "code_or_paid";
            var data = { title: title.value.trim(), description: desc.value.trim(), stage: stage.value, grade: Number(grade.value), videoRef: video.value.trim(),
                accessMode: mode.value, price: paid ? Number(price.value) || 0 : 0, isPublished: pub.checked };
            if (!data.videoRef.startsWith("http")) { msg.textContent = "الرابط لازم يبدأ بـ https://"; return; }
            go.disabled = true;
            try {
                var r = s ? await E.call("PATCH", "/api/teacher/sessions/" + s.id, data) : await E.call("POST", "/api/teacher/sessions", data);
                var saved = r.session, warn = "";
                if (cover.files[0]) { try { await E.upload("PUT", "/api/teacher/courses/" + saved.id + "/cover", cover.files[0]); } catch (e) { warn += " (الغلاف: " + (e.message || "فشل") + ")"; } }
                if (pdf.files[0] && saved.lessonId) { try { await E.upload("PUT", "/api/teacher/lessons/" + saved.lessonId + "/pdf?name=" + encodeURIComponent(pdf.files[0].name), pdf.files[0]); } catch (e) { warn += " (الـ PDF: " + (e.message || "فشل") + ")"; } }
                E.toast((s ? "اتحفظت الحصة" : "اتضافت الحصة") + warn, warn ? "bad" : undefined);
                editingId = null;
                await sessionsView();
            } catch (e) { msg.textContent = e.message || "حصل خطأ"; go.disabled = false; }
        });
        return h("div", { class: "ac_card" }, [h("h2", { class: "ac_h2", text: s ? "تعديل الحصة" : "إضافة حصة جديدة" }), form]);
    }

    async function sessionsView() {
        var b = body(); E.clear(b);
        var list = [];
        await run(async function () { list = (await E.call("GET", "/api/teacher/sessions")).sessions; });
        var editing = editingId && list.filter(function (x) { return x.id === editingId; })[0];
        b.appendChild(sessionForm(editing || null));
        var card = h("div", { class: "ac_card" }, [h("h2", { class: "ac_h2", text: "كل الحصص" })]);
        if (!list.length) card.appendChild(h("p", { class: "ac_empty", text: "لسه مفيش حصص. ضيف أول حصة من النموذج اللي فوق." }));
        else {
            var rows = list.map(function (s) {
                var multi = s.lessonCount !== 1;
                return h("tr", null, [
                    h("td", { text: s.title }),
                    h("td", { text: E.GRADES[s.grade] ? "الصف " + E.GRADES[s.grade] : String(s.grade) }),
                    h("td", null, [multi ? h("span", { class: "ac_pill", text: E.num(s.lessonCount) + " دروس - إدارة متقدمة" }) : h("span", { dir: "ltr", text: short(s.videoRef) })]),
                    h("td", { text: (MODE_SHORT[s.accessMode] || s.accessMode) + (s.price > 0 && (s.accessMode === "paid" || s.accessMode === "code_or_paid") ? " - " + E.num(s.price) + " ج" : "") }),
                    h("td", { text: E.num(s.enrolledCount) }),
                    h("td", null, [h("span", { class: "ac_pill " + (s.isPublished ? "p_ok" : ""), text: s.isPublished ? "منشورة" : "مخفية" })]),
                    h("td", null, [h("div", { class: "ac_row" }, [
                        multi ? null : h("button", { type: "button", class: "ac_btn b_dark b_sm", text: "تعديل", onclick: function () { editingId = s.id; sessionsView().then(function () { window.scrollTo({ top: 0, behavior: "smooth" }); }); } }),
                        ui.manageCourse ? h("button", { type: "button", class: "ac_btn b_line b_sm", text: "أكواد وطلاب", onclick: function () { ui.manageCourse(s.id); } }) : null,
                        h("button", { type: "button", class: "ac_btn b_line b_sm", text: s.isPublished ? "إخفاء" : "نشر", onclick: function () {
                            run(async function () { await E.call("POST", "/api/teacher/courses/" + s.id + (s.isPublished ? "/unpublish" : "/publish"), {}); E.toast(s.isPublished ? "اتخفت الحصة" : "اتنشرت الحصة"); await sessionsView(); });
                        } }),
                        h("button", { type: "button", class: "ac_btn b_bad b_sm", text: "حذف", onclick: async function () {
                            if (!(await E.confirmBox("هتمسح الحصة «" + s.title + "» ومعاها اشتراكات الطلاب فيها. مفيش رجوع. متأكد؟", "احذف الحصة"))) return;
                            run(async function () { await E.call("DELETE", "/api/teacher/courses/" + s.id); E.toast("اتحذفت الحصة"); await sessionsView(); });
                        } })
                    ])])
                ]);
            });
            card.appendChild(h("div", { class: "ac_tablewrap" }, [h("table", { class: "ac_table" }, [
                h("thead", null, [h("tr", null, ["الحصة", "الصف", "الفيديو", "الاشتراك", "المشتركين", "الحالة", ""].map(function (t) { return h("th", { text: t }); }))]),
                h("tbody", null, rows)
            ])]));
        }
        b.appendChild(card);
    }
    ui.views.sessions = sessionsView;
})();
