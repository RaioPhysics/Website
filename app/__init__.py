from flask import Flask, request, current_app
from flask_sqlalchemy import SQLAlchemy
from config import Config
#import logging

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

    # Set up logging
    #logging.basicConfig(level=logging.DEBUG)

    @app.after_request
    def add_security_headers(response):
        #current_app.logger.debug(f"Request endpoint: {request.endpoint}")
        
        # Cache policy for specific endpoints
        if request.endpoint in ['main.index', 'main.modules', 'main.page2']:
            response.headers['Cache-Control'] = 'no-cache, max-age=0, must-revalidate'
        elif request.endpoint == 'static':
            response.headers['Cache-Control'] = 'max-age=31536000, immutable'
        else:
            response.headers['Cache-Control'] = 'no-store, no-cache, max-age=0, must-revalidate'

        response.headers['X-Content-Type-Options'] = 'nosniff'
        return response

    return app


