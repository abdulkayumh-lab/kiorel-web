// =========================================
// Kiorel - Main JavaScript
// Version 1.0
// =========================================

document.addEventListener("DOMContentLoaded", () => {
    console.log("Kiorel loaded successfully.");

    // Smooth scrolling
    document.querySelectorAll('a[href^="#"]').forEach(link => {
        link.addEventListener("click", function (e) {
            const target = document.querySelector(this.getAttribute("href"));

            if (target) {
                e.preventDefault();
                target.scrollIntoView({
                    behavior: "smooth"
                });
            }
        });
    });

    // Hero button
    const heroButton = document.querySelector(".btn-primary");

    if (heroButton) {
        heroButton.addEventListener("click", function (e) {
            e.preventDefault();
            alert("🚀 Early Access is coming soon!");
        });
    }
});