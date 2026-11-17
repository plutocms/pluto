---
title: Contact
slug: contact
recipients: hello@example.com
subject: New message from the playground
successMessage: Thank you. We got your message and we will answer soon.
retentionDays: 180
---
::form-input{label="Name" required width="half"}
::

::form-input{label="Email" type="email" required width="half"}
::

::form-select{label="Subject" options="General question; Support; Partnership" required}
::

::form-textarea{label="Message" required help="Tell us how we can help." minLength="10"}
::

::form-consent{label="I agree that you keep my message to answer it." link="/about"}
::

::form-submit{label="Send message"}
::
