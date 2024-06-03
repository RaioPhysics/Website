from flask import Flask
from flask_sqlalchemy import SQLAlchemy
from config import Config

db = SQLAlchemy()

def create_app(config_class=Config):
    app = Flask(__name__)
    app.config.from_object(config_class)

    db.init_app(app)

    with app.app_context():
        from .models import UploadedFile  # Ensure this import is within the app context
        db.create_all()  # Create database tables for models

    from .routes import main as main_blueprint
    app.register_blueprint(main_blueprint)

    return app
