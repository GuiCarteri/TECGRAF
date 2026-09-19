const loginForm = document.getElementById("login-form");

loginForm.addEventListener("submit", function (event) {
    event.preventDefault();

    const email = document.getElementById("email").value.trim();
    const password = document.getElementById("password").value.trim();

    if (email === "" || password === "") {
        alert("Preencha o e-mail e a senha.");
        return;
    }

    window.location.href = "./home.html";
});