const SENT = "sent";
const INBOX = "inbox";
const ARCHIVE = "archive";
const COMPOSE = "compose";
const EMAIL = "email";

function isValidMailbox(mailbox) {
    return mailbox === INBOX || mailbox === SENT || mailbox === ARCHIVE;
}

const getMailboxView = () => document.getElementById("mailbox-view");
const getComposeView = () => document.getElementById("compose-view");
const getEmailView = () => document.getElementById("email-view");

const moveToMailbox = () => {
    getMailboxView().style.display = "block";
    getComposeView().style.display = "none";
    getEmailView().style.display = "none";
};

const moveToEmail = () => {
    getMailboxView().style.display = "none";
    getComposeView().style.display = "none";
    getEmailView().style.display = "block";
};

const moveToCompose = () => {
    getMailboxView().style.display = "none";
    getComposeView().style.display = "block";
    getEmailView().style.display = "none";
};

window.onpopstate = (event) => {
    const state = event.state;
    const section = state.section;
    if (section === COMPOSE) compose_email();
    else if (section === EMAIL) view_email(state.id);
    else load_mailbox(section);
};

document.addEventListener("DOMContentLoaded", function() {
    // Use buttons to toggle between views
    document
        .querySelector("#inbox")
        .addEventListener("click", () => load_mailbox(INBOX));
    document
        .querySelector("#sent")
        .addEventListener("click", () => load_mailbox(SENT));
    document
        .querySelector("#archived")
        .addEventListener("click", () => load_mailbox(ARCHIVE));
    document
        .querySelector("#compose")
        .addEventListener("click", () => compose_email());
    document.querySelector("#compose-form").onsubmit = send_email;

    // By default, load the inbox
    load_mailbox("inbox");
});

function compose_email(
    initialData = {
        recipients: "",
        subject: "",
        body: "",
    }
) {
    history.pushState({ section: COMPOSE }, "", "");
    moveToCompose();

    // Update initial values of the form.
    document.querySelector("#compose-recipients").value = initialData.recipients;
    document.querySelector("#compose-subject").value = initialData.subject;
    document.querySelector("#compose-body").value = initialData.body;
}

function send_email() {
    const recipients = document.getElementById("compose-recipients").value;
    const subject = document.getElementById("compose-subject").value;
    const body = document.getElementById("compose-body").value;

    fetch("/emails", {
            method: "POST",
            body: JSON.stringify({
                recipients: recipients,
                subject: subject,
                body: body,
            }),
        })
        .then((response) => response.json())
        .then((result) => {
            console.log(result);
            error = result["error"];
            const errorElement = document.getElementById("error");
            if (error !== undefined) {
                errorElement.style.display = "block";
                errorElement.innerHTML = error;
            } else {
                errorElement.style.display = "none";
                load_mailbox("sent");
            }
        })
        .catch((error) => console.log(error));

    return false;
}

function load_mailbox(mailbox) {
    // Make sure the mailbox is correct
    if (!isValidMailbox(mailbox)) {
        console.log(`Invalid mailbox, redireting to ${INBOX}`);
        load_mailbox(INBOX);
        return;
    }

    history.pushState({ section: mailbox }, "", "");
    moveToMailbox();

    const mailboxView = getMailboxView();

    // Show the mailbox name
    mailboxView.innerHTML = `<h3>${
    mailbox.charAt(0).toUpperCase() + mailbox.slice(1)
  }</h3>`;

    const handleEmail = (email) => {
        console.log(email);
        const emailElement = mailboxView.appendChild(document.createElement("div"));
        emailElement.className = "row border mb-1 mt-0 mx-1 py-2";
        emailElement.id = email.id;
        emailElement.onclick = () => view_email(email.id, mailbox === SENT);
        if (email.read) emailElement.style.backgroundColor = "lightgray";

        const createColumn = (content, width) => {
            const column = emailElement.appendChild(document.createElement("div"));
            column.className = `col-${width}`;
            column.innerHTML = content;
            return column;
        };

        createColumn(`<b>From: </b> ${email.sender}`, 3);
        createColumn(`<b>Subject: </b> ${email.subject}`, 6);
        createColumn(`<b>Date: </b> ${email.timestamp}`, "auto").classList.add(
            "ml-auto"
        );
    };

    fetch(`emails/${mailbox}`)
        .then((response) => response.json())
        .then((emails) => emails.forEach(handleEmail))
        .catch((error) => console.log(error));
}

function view_email(id, isSentEmail) {
    history.pushState({ section: EMAIL, id: id }, "", "");
    moveToEmail();

    const senderView = document.getElementById("email-sender");
    const recipientsView = document.getElementById("email-recipients");
    const subjectView = document.querySelectorAll(".email-subject");
    const bodyView = document.getElementById("email-body");
    const replyButton = document.getElementById("email-reply-button");
    const archiveButton = document.getElementById("email-archive-button");

    fetch(`emails/${id}`)
        .then((response) => response.json())
        .then((result) => {
            senderView.innerHTML = result.sender;
            recipientsView.innerHTML = result.recipients;
            subjectView.forEach((subject) => (subject.innerHTML = result.subject));
            bodyView.innerHTML = result.body;
            replyButton.onclick = () => replyHandler(result);

            if (isSentEmail) {
                archiveButton.style.display = "none";
            } else {
                archiveButton.style.display = "block";
                archiveButton.onclick = () => archiveHandler(result.id);
                archiveButton.textContent = result.archived ? "Unarchive" : "Archive";
            }
        })
        .catch((error) => console.log(error));

    fetch(`emails/${id}`, {
        method: "PUT",
        body: JSON.stringify({
            read: true,
        }),
    });
}

function archiveHandler(id) {
    fetch(`emails/${id}`)
        .then((response) => response.json())
        .then((result) => {
            const isArchived = result.archived;
            fetch(`emails/${id}`, {
                method: "PUT",
                body: JSON.stringify({
                    archived: !isArchived,
                }),
            }).then(() => load_mailbox(INBOX));
        })
        .catch((error) => console.log(error));
}

function replyHandler(email) {
    let subject = email.subject;
    if (!/^Re: /.test(subject)) {
        subject = "Re: " + subject;
    }
    const body = `\n On ${email.timestamp} ${email.sender} wrote:\n ${email.body}`;
    compose_email({
        recipients: email.sender,
        subject: subject,
        body: body,
    });
}