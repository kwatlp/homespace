# Putting it online

You have a zip file called something like `my-homespace-website.zip`. Inside it
is your whole website: pages, pictures, everything. Putting it online means
handing that zip to a computer that is always on.

You do not need to know how any of that works, and you do not need a card.

## The short version

Whatever host you pick, the job is the same:

1. Make an account.
2. Upload the zip — or the folder inside it.
3. Your site is at the address they give you.

If a host asks you to "connect a repository", "run a build command", or
"configure a framework", you are on the wrong page of their documentation.
Your site is already built. It is just files.

## Step by step, on a phone or a computer

These steps use **Neocities**, because the whole thing — signing up, uploading,
getting a web address — works in a phone browser. Most other hosts assume you
are dragging a folder on a desktop.

1. Go to **neocities.org** and choose **Sign up**.
2. Pick a site name. That becomes your address: `yourname.neocities.org`.
   You can point your own domain at it later.
3. Enter an email and a password. There is no card, and the free plan is a
   real plan, not a trial.
4. You land on your dashboard, which already has a starter `index.html`.
   Delete that file — yours is about to replace it.
5. Choose **Upload**, then pick your `…-website.zip`.
   Neocities unzips it for you and puts the files where they belong.
6. Open your address. That is your homespace, live.

If your host does *not* unzip for you, unzip the file yourself first and upload
everything inside it — the `index.html` has to end up at the top level, not
inside another folder.

## Any other host

The same files work anywhere that serves static files, which is nearly
everywhere. If a friend recommends a host, or your school or workplace already
gives you web space, use that. The rules are always these two:

- Upload the **contents** of the website zip, not the zip itself.
- `index.html` goes at the top.

There is no lock-in to undo if you move. Your site is a folder; take it with
you.

## Keep your master copy

The second download — `…-master-copy.zip` — is not for uploading. It is the
originals: your pictures, your words, and the settings that made the site look
the way it does. Keep it somewhere you will find it again.

When you want to change something, change it in there and build it again:

```sh
npx homespace build
```

That needs [Node](https://nodejs.org) on a computer. It makes a fresh `dist`
folder, and that folder is the new version of your site — upload it the same
way you uploaded the first one.

## A word about what this is not

We are not a host, we do not resell hosting, and we get nothing if you use one
host over another. Your site never passes through us: the Builder runs in your
browser, and the zip goes from your device to your host. That is the whole
arrangement.
