/* ==========================================
   KIOREL
   Main JavaScript
========================================== */

document.addEventListener("DOMContentLoaded", () => {

    // Navbar background on scroll
    const header = document.querySelector("header");

    window.addEventListener("scroll", () => {
        if (window.scrollY > 60) {
            header.style.background = "rgba(7,17,31,.95)";
            header.style.boxShadow = "0 8px 30px rgba(0,0,0,.25)";
        } else {
            header.style.background = "rgba(8,15,30,.75)";
            header.style.boxShadow = "none";
        }
    });

    // Smooth scroll
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener("click", function (e) {

            const target = document.querySelector(this.getAttribute("href"));

            if (target) {
                e.preventDefault();

                target.scrollIntoView({
                    behavior: "smooth"
                });
            }

        });
    });

    // Buttons

    const primary = document.querySelector(".primary-btn");

    if (primary) {

        primary.addEventListener("click", function (e) {

            e.preventDefault();

            alert("🚀 Kiorel Beta is coming soon!");

        });

    }

    const secondary = document.querySelector(".secondary-btn");

    if (secondary) {

        secondary.addEventListener("click", function (e) {

            e.preventDefault();

            alert("📚 Documentation will be available soon.");

        });

    }

    // Scroll animation

    const cards = document.querySelectorAll(".feature-card,.stat-box");

    const observer = new IntersectionObserver((entries) => {

        entries.forEach(entry => {

            if (entry.isIntersecting) {

                entry.target.style.opacity = "1";
                entry.target.style.transform = "translateY(0)";

            }

        });

    }, {
        threshold: 0.15
    });

    cards.forEach(card => {

        card.style.opacity = "0";
        card.style.transform = "translateY(40px)";
        card.style.transition = "all .6s ease";

        observer.observe(card);

    });

});