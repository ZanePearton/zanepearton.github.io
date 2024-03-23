
// CV Terminal Class • Start • 
class CVTerminal {
  terminal;
  isAnimating;
  command;
  addons;
  addonsConfig;
  prompt;
  promptLength;
  cursorX;
  printingFullCV;
  interrupted;
  commands;
  cvSections;
  cv;
  currentSectionIndex;
  animationFrameId;

  constructor(config) {
    this.config = config;
    this.initializeProperties();
    this.installAddons();
    this.openTerminal(this.config.container);
    this.fitTerminal();
    this.registerEvents();
    this.writeWelcomeMessage();
  }

  fitTerminal() {
    const fitAddon = this.addons["FitAddon"];
    fitAddon && fitAddon.fit();
  }

  openTerminal(container) {
    this.terminal.open(container);
    this.terminal.focus();
  }

  writeWelcomeMessage() {
    this.terminal.writeln("Hello There...");
    this.terminal.writeln("Type 'help' to see available commands.");
    this.writePrompt();
  }

  initializeProperties() {
    this.terminal = new Terminal(this.config.terminal);
    this.isAnimating = false;
    this.command = "";
    this.addons = {};
    this.addonsConfig = this.config.addons;
    this.prompt = this.config.cv.prompt;
    this.promptLength = this.prompt.length;
    this.cursorX = this.promptLength;
    this.printingFullCV = false;
    this.interrupted = false;
    this.commands = new Set(this.config.cv.commands);
    this.cvSections = new Set(this.config.cv.cvSections);
    this.cv = this.config.cv.cv;
    this.currentSectionIndex = 0;
    this.animationFrameId = 1;
  }

  installAddons() {
    this.addons = {};
    for (const addon of this.addonsConfig) {
      const addonConstructor = Object.values(addon.instance)[0];
      const addonInstance = new addonConstructor();
      this.addons[addon.instance.name] = addonInstance;
      this.terminal.loadAddon(addonInstance);
      if (addon.autoFit) {
        addonInstance.fit();
      }
    }
  }

  registerEvents() {
    this.terminal.onKey((event) => this.handleKeyEvent(event));
    window.addEventListener("resize", () => this.fitTerminal());

    document.addEventListener("click", (event) => {
      const isTerminalClick = event.composedPath().some((el) => el === this.terminal.element);
      if (isTerminalClick) {
        this.terminal.focus();
      } else if (!isTerminalClick) {
        this.terminal.blur();
      }
    });
  }

  handleKeyEvent({ key, domEvent }) {
    const isCtrlC = domEvent.ctrlKey && domEvent.key.toLowerCase() === "c";
    const isPrintable = !domEvent.altKey && !domEvent.ctrlKey && !domEvent.metaKey;

    const KEYCODE = {
      Backspace: "Backspace",
      Enter: "Enter",
      ArrowUp: "ArrowUp",
      ArrowDown: "ArrowDown",
      ArrowLeft: "ArrowLeft",
      ArrowRight: "ArrowRight",
    };

    if (this.isAnimating && isCtrlC) {
      return this.interruptAnimation();
    }
    if (this.isAnimating) return;

    switch (domEvent.key) {
      case KEYCODE.Backspace:
        this.handleBackspace();
        break;
      case KEYCODE.Enter:
        this.handleReturn();
        break;
      case KEYCODE.ArrowUp:
      case KEYCODE.ArrowDown:
      case KEYCODE.ArrowLeft:
      case KEYCODE.ArrowRight:
        break;
      default:
        if (isPrintable) {
          this.handleInput(key);
        }
    }
  }

  stopAnimation() {
    this.interrupted = false;
    this.isAnimating = false;
    cancelAnimationFrame(this.animationFrameId);
    this.resetFullCV();
  }

  handleBackspace() {
    if (this.cursorX > this.promptLength) {
      this.terminal.write("\b \b");
      this.cursorX;
    }
  }

  handleReturn() {
    this.terminal.writeln("");
    this.handleCommand();
    this.command = "";
    this.cursorX = this.promptLength;
    if (!this.isAnimating) {
      this.writePrompt();
    }
  }

  handleInput(key) {
    this.terminal.write(key);
    this.command += key;
    this.cursorX++;
  }

  writePrompt() {
    this.terminal.write(this.prompt);
  }

  handleCommand() {
    const trimmedCommand = this.command.trim();

    if (this.commands.has(trimmedCommand)) {
      switch (trimmedCommand) {
        case "help":
          this.writeHelp();
          break;
        case "fullcv":
          this.startFullCV();
          break;
        default:
          this.writeSection(trimmedCommand);
      }
    } else {
      this.terminal.writeln(" ERROR: Command not recognized: " + trimmedCommand + "!");
      this.terminal.writeln("Type 'help' to see available commands.");
    }
  }

  writeHelp() {
    let helpText = "\n  AVAILABLE COMMANDS:\n\n";
    for (const cmd of this.commands) {
      helpText += "• " + cmd + "\n";
    }

    this.isAnimating = true;
    this.animateTyping(helpText, 0, () => {
      this.isAnimating = false;
      this.writePrompt();
    });
  }

  startFullCV() {
    this.printingFullCV = true;
    this.handleFullCVCommand();
  }

  writeSection(sectionName) {
    const section = "\n  " + sectionName.toUpperCase();
    this.terminal.writeln(section);
    const commandInfo = "\r\n" + this.cv[sectionName].join('\n');

    if (this.interrupted) return;

    this.isAnimating = true;
    this.animateTyping(commandInfo, 0, () => {
      this.isAnimating = false;
      if (this.printingFullCV) {
        this.handleFullCVCommand();
      } else {
        this.writePrompt();
      }
    });
  }

  handleFullCVCommand() {
    const cvSectionsArray = Array.from(this.cvSections);

    if (this.currentSectionIndex >= cvSectionsArray.length) {
      this.resetFullCV();
      this.writePrompt();
    } else {
      this.printingFullCV = true;
      const command = cvSectionsArray[this.currentSectionIndex];
      this.currentSectionIndex++;
      this.writeSection(command);
    }
  }

  resetFullCV() {
    this.currentSectionIndex = 0;
    this.printingFullCV = false;
  }

  animateTyping(text, pos, callback) {
    if (this.interrupted) {
      return this.stopAnimation();
    }

    if (pos < text.length) {
      this.terminal.write(text.charAt(pos));
      if (text.charAt(pos) === "\n") {
        this.terminal.write("\r");
      }
      this.animationFrameId = requestAnimationFrame(() =>
        this.animateTyping(text, pos + 1, callback)
      );
    } else {
      this.terminal.writeln("\r");
      this.isAnimating = false;
      callback && callback();
    }
  }

  interruptAnimation() {
    this.stopAnimation();
    this.terminal.write("\r\n\nInterrupted\r\n\n");
    this.writePrompt();
  }
}

// Initialize the terminal 
window.onload = () => {

  const addonsConfig = [
    { instance: FitAddon, autoFit: true },
    { instance: WebLinksAddon },
  ];

  
  const terminalSettings = {
    "fontSize": 9,
    "fontFamily": "'VT323', monospace", // Make sure 'VT323' is loaded as shown earlier
    "cursorStyle": "block",
    "cursorBlink": true,
    "theme": {
      "background": "#000000",
      "foreground": "#00ff00",
      "cursor": "#00ff00"
    },
    "cols": 50,
    "rows": 22
  };


  const cvInteraction = {
    "commands": [
      "about",
      "experience",
      "projects",
      "education",
      "certifications",
      "contact",
      "help"
    ],
    "cvSections": [
      "Zane about",
      "Zane's experience",
      "Zane's projects",
      "Zane's education",
      "certifications",
      "contact"
    ],
    "cv": {
      "about": [
        "Name: Zane Pearton",
        "Role: Data Engineer",
        "Company: Accenture",
        "Aus / EU citizenship 🇦🇺🇦🇹.As a Software Engineering Specialist at Accenture, I possess a multifaceted skill set across a broad range of technologies and methodologies. My expertise encompasses Data Engineering, Automation, Continuous Integration/Continuous Deployment (CI/CD), Software Engineering, and Platform Engineering. I am proficient in developing and integrating bespoke tools leveraging platforms and languages such as AWS, Azure, Salesforce, Git, GitHub, Azure DevOps, GitHub Actions, Java, Bash, JavaScript, Python, YAML, and PowerShell.",
        "My technical proficiency extends to Unreal Engine, Rhino, Revit, Grasshopper, 3DS Max, the Adobe Suite, Octane, 3D printing, and virtual reality solutions including Oculus and Unity. I have substantial experience in Augmented Reality (AR), User Interface (UI) design, Virtual Reality (VR) presentations, and web development, with a focus on technologies like JavaScript, Three.js, HTML, and CSS.",
        "In the domain of software containerization and API management, I am skilled in Docker, and API sandboxing tools such as Postman and Getsandbox. My development approach is often event•driven, utilizing webhooks and adaptive cards, and I am well•versed in machine learning libraries including TensorFlow and PyTorch. Additionally, I have competencies in WordPress, web hosting, and a comprehensive array of collaboration tools.",
        "This diverse expertise allows me to contribute effectively to projects across various stages of development, from conceptualization to deployment, ensuring high•quality software solutions that meet and exceed expectations.",
        "Key Areas of Expertise:",
        "• Data Engineering/Transformation: Expertise in Snowflake, Pandas, Numpy, and Python.",
        "• Data Visualization: Proficient in Streamlit, PowerBI, and React.",
        "• Data Storage Solutions: Experience with Snowflake and AWS DocumentDB.",
        "• Development and Operations Technologies: Skilled in Azure DevOps, GitHub Actions, TFS, Docker, and cloud platforms AWS/Azure.",
        "• Software and Systems Engineering: Well•versed in Java, Swift, TensorFlow, PyTorch, Salesforce, and repository management.",
        "• Collaboration and Project Management: Efficient in using JIRA, Confluence, Teams, Slack for project tracking and team colab.",
        "• Design and Creative Technologies: Proficient in 3D modeling, graphic design, virtual reality, and web technologies.",
        "• Security and Compliance: Knowledgeable in Checkmarx and Fortify for security analysis.",
        "• API Development and Testing: Experienced with API tools and event•driven development including AWS Lambda"
        
      ],
      "experience": [
        "Data Engineer",
        "Key Responsibilities:",
        "As a Data Engineer, I analyze data extracts from Collibra and Snowflake, coordinating with data management. My role also involves automating data transformation processes. I've developed a Streamlit dashboard for automated keyword generation using Python, NLTK, and Pandas, significantly enhancing text data analysis by streamlining keyword identification.​",
        "Achievements:",
        "• Data Wearhouse: Snowflake",​
        "• Data Governance: Colibra",​
        "• Automation of Data Transformation: Python, Pandas, SQL",​
        "• Data Dashboard: Streamlit",

        "Devops Engineer",
        "Key Responsibilities:",
        "In this role, I was responsible for driving the adoption and optimization of DevOps methodologies. My key contributions included implementing CI/CD pipelines, deployment of AWS cloud services through automation, and facilitating the transition of development practices to a more streamlined and agile approach. I also played a crucial role in knowledge transfer, conducting training sessions and presentations to enhance engineering teams.​",
        "Achievements:",
        "• CI/CD Pipeline Development: Designed and executed CI/CD pipelines tailored for AWS services (Lamda, SQS, Document DB) to enhance the software deployment process utilising cloud formation.",​
        "• CI/CD Methodology Implementation: Played a pivotal role in the introduction of CI/CD practices to improving development and operational efficiency.",​
        "• Proof of Concept (POC) Execution: Developed POCs for microservice CI/CD pipelines integrating Jest for unit testing, and deployed services like SNS, SQS, and Lambda using Terraform.",​
        "• Artifactory Integration: Implemented Artifactory for Continuous Deployment, enabling better version control and deployment practices.",​
        "• Customized Pipeline Solutions: Created customized TFS CI/CD pipelines in PowerShell, catering to unique project requirements.",​
        "• CI for Node.js Microservices: Established Continuous Integration practices for Node.js microservices, ensuring code quality with unit testing.",​
        "• CD for Node.js Microservices: Advanced the Continuous Deployment processes for Node.js microservices architecture, utilizing AWS SAM CLI and CloudFormation templates to create scalable infrastructure stacks.",​
        "• EC2 Build Servers: Configured and managed EC2 Build Servers, supervised the installation of TFS Agents, and transitioned pipelines from TFS to Azure DevOps.",​
        "• CI/CD Documentation: Authored comprehensive documentation for continuous integration pipeline processes.",​
        "• Knowledge Sharing: Presented on DevOps and CI/CD processes in 'Brownbag' educational sessions to software developers.",​
        "• Intermediate Training: Conducted intermediate-level training on build services for the DevOps team, enhancing team capabilities and understanding of build and deployment systems.",
        
        "Devops Engineer",
        "RKey Responsibilities:",
        "In this role, I was responsible for implementeding DevOps initiatives to enhance security, optimize deployments, and improve development operations. Key moments of this project  include the successful integration of a Static Application Security Testing Tool into the CI/CD pipeline, streamlining API migration processes, and implementing robust monitoring tools for Azure DevOps environments. I played a pivotal role in creating agile pipeline creation processes, managing Vlocity upgrades within Salesforce, and innovating deployment strategies to minimize downtime. My efforts ensured rapid, secure, and efficient delivery cycles, contributing to the overall excellence in deployment and development practices",​
        "DevSecOps Pipeline Development: Executed a Proof of Concept (POC) for the integration of a Static Application Security Testing Tool (Checkmarx SAST) into the Salesforce CI/CD pipeline, focusing on code security analysis.",​
        "Achievements:",
        "• API Migration: Led the migration of the Getsandbox API to Postman, ensuring cross-compatibility and enhanced response routing to Salesforce endpoints.",​
        "• Monitoring Tool Implementation: Created a monitoring tool for Scratch Org Pools and Package Monitoring in Azure DevOps, streamlining validation processes and package status monitoring for development teams.",​
        "• Pipeline Creation and Management: Developed capabilities for rapid creation and cloning of Azure DevOps (ADO) pipelines, facilitating unscheduled deployments with minimal preparation.",​
        "• Vlocity Upgrades and Installations: Managed the installation and upgrading of Vlocity within the Salesforce environment, performing associated pre/post deployment tasks.",​
        "• CI/CD Pipeline Enhancements: Integrated Vlocity into CI/CD pipelines, utilizing Puppeteer and Vlocity CLI, and implemented scripts for efficient deployment of Salesforce Data Categories.",​
        "• Deployment Excellence: Improved deployment processes by implementing a mix of delta/full package deployments, reducing downtime and accelerating the handover for testing.",​
        "• Breakpoint Identification: Established methods for identifying and resolving critical deployment breaks, directing essential feedback to developers",
        
        "Application Development",
        "Key Responsibilities:",
        "In this role, I was responsible for implementeding demonstrating the functionality of newly developed features to clients, ensuring that the product met both quality standards and user requirements.",​
        "Achievements:",
        "• Conducting comprehensive Salesforce functional testing to ensure product quality and performance met stringent standards.",​
        "• Demonstrating new feature functionality to stakeholders, ensuring clarity and understanding of product developments and updates.",​
        "• Evaluating product quality to identify areas of improvement, thereby contributing to the ongoing refinement of the Salesforce application"
      ],
      "projects": [
        "• Langchaingpt: A Python library for NLP and text processing.",
        "• McDeepNet: Machine Learning model for analyzing McDonald's reviews.",
        "• G•Net: TensorFlow implementation of GANs for image generation.",
        "• neuroSnake: A ML•powered Snake game.",
        "• MSGR•ChatApp: A chat application using React and Firebase."
      ],

      "education": [
        "RMIT • Masters in Architecture",
        "RMIT • Bachelor's in Architecture",
        "Cert • IV Cybersecturity"
      ],
      "certifications": [
        "• PCEP Certified Entry Level Python Programmer",
        "• Amazon Web Services Cloud Practitioner",
        "• IBM COBOL Programming with VSCode",
        "• IBM Containers & Kubernetes Essentials",
        "• IBM Deep Learning using TensorFlow",
        "• GitLab Gitlab CICD Associate",
        "• GitLab Gitlab CI Fundamentals",
        "• Azure AI 400 Devops Solutions",
        "• Azure AI 204 Azure AI Engineer Associate",
        "• Azure DP 203 Azure Data Engineer Associate",
        "• Azure DP 100 Azure Data Scientist Associate",
        "• Azure AI 900 Azure AI Fundamentals",
        "• Azure DP 900 Azure Data Fundamentals",
        "• Azure AZ 900 Azure Fundamentals",
        "• Azure SC 900 Security Fundamentals",
        "• Python Foundation Programming Python",
        "• Cisco Cybersecurity Essentials Intro to IOT",
        "• NDG Linux Essentials Cisco",
        "• SkillSoft Security Analyst",
        "• Google Introduction to Responsible AI",
        "• Google Introduction to Large Language Models",
        "• Google Introduction to Generative AI",
        "• Cert IV Cybersecurity"
    ],

      "contact": [
        "LinkedIn: https://www.linkedin.com/in/zane•pearton",
        "GitHub: ZanePearton",
        "Linktree: https://linktr.ee/zanepearton"
      ]
    },
    "prompt": "root > "
  };


  const terminalConfigurations = {
    terminal: terminalSettings,
    cv: cvInteraction,
    addons: addonsConfig,
    container: document.querySelector("#terminal"),
  };

  new CVTerminal(terminalConfigurations);
}
