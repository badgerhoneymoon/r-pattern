
# CLONING THIS REPO

## 📁 1. Clone the Starter Template

cd ~/Python

git clone https://github.com/badgerhoneymoon/starter.git my-new-project

cd my-new-project

cursor .

⸻

## 🧹 2. [IN CURSOR] Remove Original Git History

rm -rf .git

This unlinks the project from the original repo.

⸻

## 🌱 3. Initialize a New Git Repo

git init

git add .

git commit -m "Initial commit from starter"

[button] Publish Branch -> Choose Public/Private

⸻

## 🚀 4. Run the Dev Server

Install dependencies and start the server:

npm install

npm run dev

Go to http://localhost:3000 to view your project.

⸻

# NextJS installation (WHEN NOT GIT CLONING)
1. go to Terminal
2. cd [code projects folder]
3. npx shadcn@latest init
4. name the project
4. default settings
5. cd to the project folder
6. cursor .

git init
git add .         
git commit -m "first commit"
git branch -M main
git remote add origin https://github.com/badgerhoneymoon/starter.git
git push -u origin main
